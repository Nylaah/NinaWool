import { useMemo, useState, type FormEvent } from 'react'
import { Camera, Download, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { useDeleteExpense, useExpenses, useRequests, useSaveExpense } from '../../lib/api'
import { signedUrl } from '../../lib/supabase'
import { EXPENSE_CATEGORIES, type Expense } from '../../lib/types'
import { dateFr, downloadCsv, euro, todayIso } from '../../lib/format'
import { Empty, ErrorNote, Field, Modal, PageTitle, Spinner } from '../../components/ui'

const CATEGORY_LABEL: Record<string, string> = {
  laine: 'Laine',
  rembourrage: 'Rembourrage',
  accessoires: 'Accessoires',
  outils: 'Outils',
  envoi: 'Envoi',
  autre: 'Autre',
}

export default function Expenses() {
  const { data: expenses, isLoading, error } = useExpenses()
  const { data: requests } = useRequests()
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)

  const months = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of expenses ?? []) {
      const key = e.spent_on.slice(0, 7)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return [...map.entries()]
  }, [expenses])

  const thisMonth = todayIso().slice(0, 7)
  const sum = (list: Expense[]) => list.reduce((s, e) => s + Number(e.amount), 0)
  const total = sum(expenses ?? [])
  const monthTotal = sum((expenses ?? []).filter((e) => e.spent_on.startsWith(thisMonth)))
  const projectName = (id: string | null) => requests?.find((r) => r.id === id)?.subject

  const openReceipt = async (path: string) => {
    const url = await signedUrl('receipts', path)
    if (url) window.open(url, '_blank', 'noopener')
  }

  const exportCsv = () =>
    downloadCsv(`ninawool-depenses-${todayIso()}.csv`, [
      ['Date', 'Description', 'Catégorie', 'Montant', 'Projet lié'],
      ...(expenses ?? []).map((e) => [e.spent_on, e.description, CATEGORY_LABEL[e.category] ?? e.category, e.amount, projectName(e.request_id)]),
    ])

  if (isLoading) return <Spinner />
  if (error) return <ErrorNote error={error} />

  return (
    <div>
      <PageTitle title="Laine et dépenses">
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!expenses?.length}>
          <Download size={16} aria-hidden="true" />
          Export CSV
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          <Plus size={18} aria-hidden="true" />
          Nouvel achat
        </button>
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="card p-4">
          <p className="text-ink-soft text-sm font-bold">Ce mois-ci</p>
          <p className="font-display tabular text-2xl font-semibold">{euro(monthTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-ink-soft text-sm font-bold">Total</p>
          <p className="font-display tabular text-2xl font-semibold">{euro(total)}</p>
        </div>
      </div>

      {months.length === 0 ? (
        <Empty title="Aucun achat enregistré">Ajoute tes pelotes, ton rembourrage, tes yeux de sécurité…</Empty>
      ) : (
        <div className="space-y-6">
          {months.map(([month, list]) => (
            <section key={month}>
              <h2 className="mb-2 flex items-baseline justify-between text-lg font-semibold capitalize">
                {new Date(`${month}-15`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                <span className="tabular text-ink-soft font-sans text-base font-bold">{euro(sum(list))}</span>
              </h2>
              <ul className="card divide-line divide-y !rounded-2xl">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{e.description}</p>
                      <p className="text-ink-soft flex flex-wrap gap-x-2 text-sm">
                        <span>{dateFr(e.spent_on)}</span>
                        <span>· {CATEGORY_LABEL[e.category] ?? e.category}</span>
                        {projectName(e.request_id) && <span>· pour {projectName(e.request_id)}</span>}
                      </p>
                    </div>
                    <span className="tabular font-extrabold whitespace-nowrap">{euro(e.amount)}</span>
                    <div className="flex shrink-0">
                      {e.receipt_path && (
                        <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Voir le ticket" title="Voir le ticket" onClick={() => void openReceipt(e.receipt_path!)}>
                          <Receipt size={16} />
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Modifier ${e.description}`} onClick={() => setEditing(e)}>
                        <Pencil size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && <ExpenseModal expense={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ExpenseModal({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { data: requests } = useRequests()
  const save = useSaveExpense()
  const del = useDeleteExpense()
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? todayIso())
  const [description, setDescription] = useState(expense?.description ?? '')
  const [category, setCategory] = useState(expense?.category ?? 'laine')
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [requestId, setRequestId] = useState(expense?.request_id ?? '')
  const [receipt, setReceipt] = useState<File | null>(null)

  // Projets proposés : ceux en cours de vie, plus celui déjà lié.
  const projects = (requests ?? []).filter(
    (r) => ['acceptee', 'en_cours', 'terminee', 'livree'].includes(r.status) || r.id === expense?.request_id,
  )

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await save.mutateAsync({
      expense: {
        ...(expense ? { id: expense.id } : {}),
        spent_on: spentOn,
        description: description.trim(),
        category,
        amount: Number(amount),
        request_id: requestId || null,
      },
      receipt,
    })
    onClose()
  }

  return (
    <Modal title={expense ? 'Modifier l’achat' : 'Nouvel achat'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Description" hint="Marque, couleur, quantité…">
          <input
            className="input"
            required
            maxLength={300}
            placeholder="Ricorumi DK, rose poudré, 4 pelotes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (€)">
            <input className="input tabular" type="number" required min={0} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date">
            <input className="input" type="date" required value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Projet lié" optional>
            <select className="input" value={requestId} onChange={(e) => setRequestId(e.target.value)}>
              <option value="">Aucun (stock)</option>
              {projects.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.subject} · {r.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <span className="label">
            Photo du ticket <span className="text-ink-soft font-semibold">· facultatif</span>
          </span>
          <label className="btn btn-outline btn-sm">
            <Camera size={16} aria-hidden="true" />
            {receipt ? receipt.name : expense?.receipt_path ? 'Remplacer la photo' : 'Prendre ou choisir une photo'}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <ErrorNote error={save.error ?? del.error} />
        <div className="flex flex-wrap justify-between gap-2">
          {expense ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={del.isPending}
              onClick={async () => {
                if (!confirm('Supprimer cet achat ?')) return
                await del.mutateAsync(expense)
                onClose()
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              Supprimer
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
