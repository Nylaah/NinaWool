import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useSaveSettings, useSettings } from '../../lib/api'
import type { PriceRange } from '../../lib/types'
import { ErrorNote, Field, PageTitle, Spinner } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'

export default function SettingsPage() {
  const { data: settings, isLoading, error } = useSettings()
  const save = useSaveSettings()
  const { session } = useAuth()
  const [open, setOpen] = useState(true)
  const [message, setMessage] = useState('')
  const [maxPerDay, setMaxPerDay] = useState('3')
  const [goal, setGoal] = useState('10')
  const [ranges, setRanges] = useState<PriceRange[]>([])
  const [saved, setSaved] = useState(false)

  const loadedId = settings?.id
  useEffect(() => {
    if (!settings) return
    setOpen(settings.orders_open)
    setMessage(settings.closed_message)
    setMaxPerDay(String(settings.max_requests_per_day))
    setGoal(String(settings.hourly_goal))
    setRanges(settings.price_ranges)
    // On ne recharge le formulaire qu'au premier chargement, pas à chaque rafraîchissement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId])

  if (isLoading) return <Spinner />
  if (error) return <ErrorNote error={error} />

  const setRange = (i: number, key: keyof PriceRange, value: string) =>
    setRanges((list) => list.map((r, j) => (j === i ? { ...r, [key]: Number(value) } : r)))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await save.mutateAsync({
      orders_open: open,
      closed_message: message.trim(),
      max_requests_per_day: Math.max(1, Number(maxPerDay) || 1),
      hourly_goal: Number(goal) || 0,
      price_ranges: [...ranges].filter((r) => r.max_cm > 0).sort((a, b) => a.max_cm - b.max_cm),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <PageTitle title="Réglages" />

      <div className="space-y-5">
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Prise de commandes</h2>
          <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 font-bold ${open ? 'bg-sage-soft' : 'bg-stone-soft'}`}>
            <input type="checkbox" className="accent-sage size-5" checked={open} onChange={(e) => setOpen(e.target.checked)} />
            {open ? 'Les commandes sont ouvertes' : 'Les commandes sont fermées'}
          </label>
          <Field label="Message affiché quand les commandes sont fermées">
            <textarea className="input min-h-20" maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <Field label="Demandes maximum par email et par jour" hint="Protection anti-spam, appliquée par la base de données.">
            <input className="input tabular !w-28" type="number" min={1} max={50} value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)} />
          </Field>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-semibold">Fourchettes de prix indicatives</h2>
          <p className="text-ink-soft mt-1 mb-4 text-sm">
            Affichées sur l’accueil et dans le formulaire, selon la taille choisie. Le prix reste libre.
          </p>
          <div className="space-y-2">
            {ranges.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm font-bold">
                <span className="text-ink-soft">Jusqu’à</span>
                <input className="input tabular !w-20 !py-1.5" type="number" min={1} aria-label="Taille maximum en cm" value={r.max_cm || ''} onChange={(e) => setRange(i, 'max_cm', e.target.value)} />
                <span className="text-ink-soft">cm : de</span>
                <input className="input tabular !w-20 !py-1.5" type="number" min={0} aria-label="Prix minimum" value={r.min || ''} onChange={(e) => setRange(i, 'min', e.target.value)} />
                <span className="text-ink-soft">à</span>
                <input className="input tabular !w-20 !py-1.5" type="number" min={0} aria-label="Prix maximum" value={r.max || ''} onChange={(e) => setRange(i, 'max', e.target.value)} />
                <span className="text-ink-soft">€</span>
                <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Supprimer cette fourchette" onClick={() => setRanges((list) => list.filter((_, j) => j !== i))}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => setRanges((list) => [...list, { max_cm: 0, min: 0, max: 0 }])}>
            <Plus size={15} aria-hidden="true" />
            Ajouter une fourchette
          </button>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">Rentabilité</h2>
          <Field label="Taux horaire visé (€ / h)" hint="Sert de repère : les projets en dessous apparaissent en rouge.">
            <input className="input tabular !w-28" type="number" min={0} step="0.5" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </Field>
        </section>

        <ErrorNote error={save.error} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            <Save size={17} aria-hidden="true" />
            {saved ? 'Enregistré !' : 'Enregistrer les réglages'}
          </button>
          <span className="text-ink-soft text-sm">Connectée en tant que {session?.user.email}</span>
        </div>
      </div>
    </form>
  )
}
