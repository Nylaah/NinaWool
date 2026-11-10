import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AtSign, ImagePlus, Mail, Pencil, Phone, Plus, Save, Trash2 } from 'lucide-react'
import {
  useDeleteRequest,
  useDeleteSession,
  useExpenses,
  useHistory,
  useRequests,
  useSaveSession,
  useSetStatus,
  useSettings,
  useUpdateRequest,
} from '../../lib/api'
import { signedUrl } from '../../lib/supabase'
import { ALL_STATUSES, FLOW, STATUS, type OrderRequest, type RequestStatus, type WorkSession } from '../../lib/types'
import { clock, dateFr, duration, euro, revenueOf, sessionMs, sortQueue, toLocalInput, todayIso, totalMs } from '../../lib/format'
import { BoostChip, CopyButton, Empty, ErrorNote, Field, Modal, Spinner, StatusChip } from '../../components/ui'
import { TimerControls, useTimerState } from '../../components/TimerWidget'
import { useNow } from '../../hooks/useNow'

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-line flex items-baseline justify-between gap-4 border-t py-2 first:border-t-0">
      <dt className="text-ink-soft text-sm font-semibold">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

/** Messages types, ouverts dans l'appli mail avec le code de suivi déjà inséré. */
function mailTemplates(r: OrderRequest) {
  const link = `${location.origin}${location.pathname}#/suivi?code=${r.tracking_code}`
  const total = euro(revenueOf(r))
  const make = (subject: string, body: string) =>
    `mailto:${r.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Bonjour ${r.name},\n\n${body}\n\nSuivi de ta commande : ${link}\n\nÀ bientôt,\nNina — NinaWool`)}`
  return [
    {
      label: 'Demande acceptée',
      href: make(`Ta demande NinaWool ${r.tracking_code} est acceptée`, `Bonne nouvelle : j’accepte ta demande « ${r.subject} » (${r.size_cm} cm) pour ${total}, à régler à la livraison. Elle entre dans ma file d’attente.`),
    },
    {
      label: 'Peluche terminée',
      href: make(`Ta peluche NinaWool est prête (${r.tracking_code})`, `Ta peluche « ${r.subject} » est terminée ! Dis-moi quand et comment tu préfères la recevoir. Pour rappel, le montant de ${total} se règle à la livraison.`),
    },
    {
      label: 'Demande refusée',
      href: make(`Ta demande NinaWool ${r.tracking_code}`, `Merci pour ta demande « ${r.subject} ». Malheureusement je ne peux pas la réaliser cette fois-ci. N’hésite pas à m’en proposer une autre !`),
    },
  ]
}

export default function RequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: requests, isLoading } = useRequests()
  const { data: history } = useHistory(id)
  const { data: expenses } = useExpenses()
  const { data: settings } = useSettings()
  const { active, sessions: allSessions } = useTimerState()
  const update = useUpdateRequest()
  const { setStatus, isPending: statusBusy, error: statusError } = useSetStatus()
  const del = useDeleteRequest()

  const r = requests?.find((x) => x.id === id)
  const sessions = allSessions.filter((s) => s.request_id === id)
  const running = active?.request_id === id
  const now = useNow(running)

  const [notes, setNotes] = useState('')
  const [finalPrice, setFinalPrice] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [editing, setEditing] = useState<WorkSession | 'new' | null>(null)

  useEffect(() => {
    setNotes(r?.private_notes ?? '')
    setFinalPrice(r?.final_price != null ? String(r.final_price) : '')
  }, [r?.id, r?.private_notes, r?.final_price])

  const imagePath = r?.reference_image_path
  useEffect(() => {
    setImageUrl(null)
    if (imagePath) void signedUrl('references', imagePath).then(setImageUrl)
  }, [imagePath])

  if (isLoading) return <Spinner />
  if (!r) {
    return (
      <Empty title="Demande introuvable">
        <Link to="/admin" className="text-rose font-bold hover:underline">
          Retour aux demandes
        </Link>
      </Empty>
    )
  }

  const position = sortQueue(requests ?? []).findIndex((x) => x.id === r.id) + 1
  const workedMs = totalMs(sessions, now)
  const linkedExpenses = (expenses ?? []).filter((e) => e.request_id === r.id)
  const spent = linkedExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const revenue = revenueOf(r)
  const hours = workedMs / 3_600_000
  const hourly = hours > 0.01 ? (revenue - spent) / hours : null
  const dirty = notes !== (r.private_notes ?? '') || finalPrice !== (r.final_price != null ? String(r.final_price) : '')
  const nextStep = FLOW[FLOW.indexOf(r.status) + 1] as RequestStatus | undefined

  const save = () =>
    update.mutate({
      id: r.id,
      patch: { private_notes: notes || null, final_price: finalPrice === '' ? null : Number(finalPrice) },
    })

  const remove = async () => {
    if (!confirm(`Supprimer définitivement la demande ${r.tracking_code} (${r.subject}) et ses sessions de travail ?`)) return
    await del.mutateAsync(r)
    navigate('/admin')
  }

  return (
    <div>
      <Link to="/admin" className="text-ink-soft hover:text-rose mb-3 inline-flex items-center gap-1 text-sm font-bold">
        <ArrowLeft size={16} aria-hidden="true" />
        Demandes
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            {r.subject} <span className="text-ink-soft text-xl font-medium">· {r.size_cm} cm</span>
          </h1>
          <p className="text-ink-soft mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="tabular text-ink tracking-wide">{r.tracking_code}</span>
            <StatusChip status={r.status} />
            <BoostChip boost={r.boost} />
            {position > 0 && <span>n° {position} dans la file</span>}
            <span>reçue le {dateFr(r.created_at, true)}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-5">
          <Section title="Statut">
            <div className="flex flex-wrap items-center gap-2">
              {r.status === 'nouvelle' && (
                <>
                  <button type="button" className="btn btn-primary" disabled={statusBusy} onClick={() => void setStatus(r, 'acceptee')}>
                    Accepter
                  </button>
                  <button type="button" className="btn btn-outline" disabled={statusBusy} onClick={() => void setStatus(r, 'refusee')}>
                    Refuser
                  </button>
                </>
              )}
              {r.status !== 'nouvelle' && nextStep && (
                <button type="button" className="btn btn-primary" disabled={statusBusy} onClick={() => void setStatus(r, nextStep)}>
                  Passer à « {STATUS[nextStep].label} »
                </button>
              )}
              <select
                className="input !w-auto !py-2 font-bold"
                aria-label="Changer de statut"
                value={r.status}
                disabled={statusBusy}
                onChange={(e) => void setStatus(r, e.target.value as RequestStatus)}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS[s].label}
                  </option>
                ))}
              </select>
            </div>
            <ErrorNote error={statusError} />
          </Section>

          <Section title="La demande">
            <dl>
              <Row label="Prix proposé">{euro(r.proposed_price)}</Row>
              <Row label="Supplément prioritaire">{Number(r.boost) > 0 ? `+ ${euro(r.boost)}` : 'aucun'}</Row>
              <Row label="Date souhaitée">{r.desired_date ? dateFr(r.desired_date) : 'non précisée'}</Row>
            </dl>
            <h3 className="text-ink-soft mt-3 font-sans text-sm font-bold">Couleurs et détails</h3>
            <p className="mt-1 whitespace-pre-wrap">{r.details || <span className="text-ink-soft">Aucun détail fourni.</span>}</p>
            {r.reference_image_path && (
              <div className="mt-4">
                <h3 className="text-ink-soft mb-1.5 font-sans text-sm font-bold">Image de référence</h3>
                {imageUrl ? (
                  <a href={imageUrl} target="_blank" rel="noreferrer">
                    <img src={imageUrl} alt={`Référence pour ${r.subject}`} className="border-line max-h-96 rounded-2xl border" />
                  </a>
                ) : (
                  <p className="text-ink-soft text-sm">Chargement de l’image…</p>
                )}
              </div>
            )}
          </Section>

          <Section
            title="Temps de travail"
            aside={
              <span className="font-display tabular text-2xl font-semibold">
                {running ? clock(workedMs) : duration(workedMs)}
              </span>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              {r.status === 'acceptee' || r.status === 'en_cours' || running ? (
                <TimerControls requestId={r.id} />
              ) : (
                <p className="text-ink-soft text-sm">Le chrono est disponible pour les projets acceptés ou en cours.</p>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing('new')}>
                <Plus size={16} aria-hidden="true" />
                Ajouter du temps
              </button>
            </div>
            {sessions.length > 0 && (
              <ul className="border-line mt-4 border-t">
                {sessions.map((s) => (
                  <li key={s.id} className="border-line flex items-center justify-between gap-3 border-b py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {dateFr(s.started_at, true)}
                        {s.ended_at == null && <span className="chip bg-honey-soft text-honey ml-2">en cours</span>}
                      </p>
                      {s.note && <p className="text-ink-soft truncate">{s.note}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <span className="tabular mr-1 font-bold">{duration(sessionMs(s, now))}</span>
                      <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Modifier la session" onClick={() => setEditing(s)}>
                        <Pencil size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Historique">
            <ol className="space-y-1.5 text-sm">
              {(history ?? []).map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-soft tabular w-36">{dateFr(h.changed_at, true)}</span>
                  {h.old_status && (
                    <>
                      <StatusChip status={h.old_status} />
                      <span aria-hidden="true">→</span>
                    </>
                  )}
                  <StatusChip status={h.new_status} />
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="min-w-0 space-y-5">
          <Section title="Client">
            <p className="text-lg font-extrabold">{r.name}</p>
            <div className="mt-2 space-y-1.5 text-[15px]">
              <p className="flex items-center gap-2 break-all">
                <Mail size={16} className="text-ink-soft shrink-0" aria-hidden="true" />
                <a href={`mailto:${r.email}`} className="hover:text-rose font-semibold underline-offset-2 hover:underline">
                  {r.email}
                </a>
              </p>
              {r.instagram && (
                <p className="flex items-center gap-2">
                  <AtSign size={16} className="text-ink-soft shrink-0" aria-hidden="true" />
                  <a
                    href={`https://instagram.com/${r.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-rose font-semibold hover:underline"
                  >
                    {r.instagram}
                  </a>
                </p>
              )}
              {r.phone && (
                <p className="flex items-center gap-2">
                  <Phone size={16} className="text-ink-soft shrink-0" aria-hidden="true" />
                  <a href={`tel:${r.phone}`} className="hover:text-rose font-semibold hover:underline">
                    {r.phone}
                  </a>
                </p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={r.email} label="Copier l’email" />
              <CopyButton text={r.tracking_code} label="Copier le code" />
            </div>
            <h3 className="text-ink-soft mt-4 mb-1.5 font-sans text-sm font-bold">Écrire un message type</h3>
            <div className="flex flex-wrap gap-1.5">
              {mailTemplates(r).map((t) => (
                <a key={t.label} href={t.href} className="btn btn-outline btn-sm">
                  {t.label}
                </a>
              ))}
            </div>
          </Section>

          <Section title="Notes privées et prix final">
            <div className="space-y-4">
              <Field label="Prix final (€)" hint={`Laisse vide pour utiliser prix proposé + boost (${euro(Number(r.proposed_price) + Number(r.boost))}).`}>
                <input
                  className="input tabular"
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                />
              </Field>
              <Field label="Notes (visibles par toi seule)">
                <textarea className="input min-h-28" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <ErrorNote error={update.error} />
              <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || update.isPending} onClick={save}>
                <Save size={15} aria-hidden="true" />
                {dirty ? 'Enregistrer' : 'Enregistré'}
              </button>
            </div>
          </Section>

          <Section title="Rentabilité du projet">
            <dl>
              <Row label="Revenu">{euro(revenue)}</Row>
              <Row label={`Dépenses liées (${linkedExpenses.length})`}>{spent > 0 ? `− ${euro(spent)}` : euro(0)}</Row>
              <Row label="Temps passé">{duration(workedMs)}</Row>
              <Row label="Taux horaire">
                {hourly == null ? (
                  '—'
                ) : (
                  <span className={settings && hourly < Number(settings.hourly_goal) ? 'text-rose-deep' : 'text-sage'}>
                    {euro(Math.round(hourly * 100) / 100)} / h
                  </span>
                )}
              </Row>
            </dl>
            <p className="hint">
              Pour lier un achat de laine à ce projet, choisis-le dans{' '}
              <Link to="/admin/depenses" className="text-rose font-bold hover:underline">
                Dépenses
              </Link>
              .
            </p>
          </Section>

          <div className="flex flex-wrap gap-2">
            {['terminee', 'livree', 'payee'].includes(r.status) && (
              <Link to={`/admin/realisations?depuis=${r.id}`} className="btn btn-outline btn-sm">
                <ImagePlus size={15} aria-hidden="true" />
                Ajouter à la galerie
              </Link>
            )}
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove()} disabled={del.isPending}>
              <Trash2 size={15} aria-hidden="true" />
              Supprimer la demande
            </button>
          </div>
          <ErrorNote error={del.error} />
        </div>
      </div>

      {editing && <SessionModal requestId={r.id} session={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Modifier une session (oubli d'arrêter le chrono…) ou ajouter du temps à la main. */
function SessionModal({ requestId, session, onClose }: { requestId: string; session: WorkSession | null; onClose: () => void }) {
  const saveSession = useSaveSession()
  const delSession = useDeleteSession()
  const [start, setStart] = useState(session ? toLocalInput(session.started_at) : `${todayIso()}T14:00`)
  const [end, setEnd] = useState(session?.ended_at ? toLocalInput(session.ended_at) : '')
  const [hours, setHours] = useState('1')
  const [minutes, setMinutes] = useState('0')
  const [note, setNote] = useState(session?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const startDate = new Date(start)
    let endDate: Date | null
    if (session) {
      endDate = end ? new Date(end) : null
    } else {
      const ms = (Number(hours) || 0) * 3_600_000 + (Number(minutes) || 0) * 60_000
      if (ms <= 0) return setError('Indique une durée supérieure à zéro.')
      endDate = new Date(startDate.getTime() + ms)
    }
    if (endDate && endDate < startDate) return setError('La fin doit être après le début.')
    if (session && !endDate && session.ended_at) return setError('Indique une heure de fin.')
    try {
      await saveSession.mutateAsync({
        ...(session ? { id: session.id } : {}),
        request_id: requestId,
        started_at: startDate.toISOString(),
        ended_at: endDate ? endDate.toISOString() : null,
        note: note || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Modal title={session ? 'Modifier la session' : 'Ajouter du temps'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Début">
          <input className="input" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        {session ? (
          <Field label="Fin" hint={session.ended_at == null ? 'Laisse vide pour garder le chrono en marche, ou indique l’heure réelle de fin.' : undefined}>
            <input className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Heures">
              <input className="input tabular" type="number" min={0} max={48} inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
            <Field label="Minutes">
              <input className="input tabular" type="number" min={0} max={59} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label="Note" optional>
          <input className="input" maxLength={200} placeholder="Tête, assemblage, finitions…" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
        <div className="flex flex-wrap justify-between gap-2">
          {session ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={delSession.isPending}
              onClick={async () => {
                if (!confirm('Supprimer cette session de travail ?')) return
                await delSession.mutateAsync(session.id)
                onClose()
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              Supprimer
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary" disabled={saveSession.isPending}>
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  )
}
