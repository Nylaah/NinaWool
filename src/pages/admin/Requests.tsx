import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowRight, Check, Download, GripVertical, Ruler, RotateCcw, Search, X, Zap } from 'lucide-react'
import { useQueueOrder, useRequests, useSetStatus } from '../../lib/api'
import { ALL_STATUSES, FLOW, STATUS, type OrderRequest, type RequestStatus } from '../../lib/types'
import { dateFr, downloadCsv, euro, revenueOf, sortQueue } from '../../lib/format'
import { BoostChip, CopyButton, Empty, ErrorNote, PageTitle, Spinner, StatusChip } from '../../components/ui'

type View = 'file' | 'liste' | 'kanban'
const VIEWS: { id: View; label: string }[] = [
  { id: 'file', label: 'File d’attente' },
  { id: 'liste', label: 'Liste' },
  { id: 'kanban', label: 'Kanban' },
]

function nextStatus(s: RequestStatus): RequestStatus | null {
  const i = FLOW.indexOf(s)
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null
}

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

export default function Requests() {
  const { data: requests, isLoading, error } = useRequests()
  const [view, setView] = useState<View>(() => (localStorage.getItem('nw-view') as View) || 'file')
  const changeView = (v: View) => {
    setView(v)
    localStorage.setItem('nw-view', v)
  }

  const priority = useMemo(
    () =>
      (requests ?? [])
        .filter((r) => Number(r.boost) > 0 && ['nouvelle', 'acceptee', 'en_cours'].includes(r.status))
        .sort(
          (a, b) => Number(b.boost) - Number(a.boost) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
    [requests],
  )

  const exportCsv = () =>
    downloadCsv(`ninawool-demandes-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Code', 'Date', 'Statut', 'Prénom', 'Email', 'Instagram', 'Téléphone', 'Sujet', 'Taille (cm)', 'Prix proposé', 'Boost', 'Prix final', 'Date souhaitée', 'Détails'],
      ...(requests ?? []).map((r) => [
        r.tracking_code, r.created_at.slice(0, 10), STATUS[r.status].label, r.name, r.email, r.instagram, r.phone,
        r.subject, r.size_cm, r.proposed_price, r.boost, r.final_price, r.desired_date, r.details,
      ]),
    ])

  if (isLoading) return <Spinner />
  if (error) return <ErrorNote error={error} />
  const all = requests ?? []

  return (
    <div>
      <PageTitle title="Demandes">
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={all.length === 0}>
          <Download size={16} aria-hidden="true" />
          Export CSV
        </button>
      </PageTitle>

      {priority.length > 0 && (
        <section aria-labelledby="prio" className="bg-honey-soft/70 border-honey-mid/40 mb-6 rounded-3xl border-2 p-4">
          <h2 id="prio" className="flex items-center gap-2 text-lg font-semibold">
            <Zap size={18} className="text-honey" aria-hidden="true" />
            Prioritaires
            <span className="chip bg-honey-mid/30 text-ink">{priority.length}</span>
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {priority.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
          </div>
        </section>
      )}

      <div className="bg-stone-soft mb-5 inline-flex rounded-full p-1" role="tablist" aria-label="Affichage">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => changeView(v.id)}
            className={`min-h-10 cursor-pointer rounded-full px-4 text-sm font-bold transition ${view === v.id ? 'bg-paper text-rose-deep shadow-sm' : 'text-ink-soft'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {all.length === 0 ? (
        <Empty title="Aucune demande pour l’instant">Les demandes envoyées depuis le site apparaîtront ici.</Empty>
      ) : view === 'file' ? (
        <QueueView requests={all} />
      ) : view === 'liste' ? (
        <ListView requests={all} />
      ) : (
        <KanbanView requests={all} />
      )}
    </div>
  )
}

// ------------------------------------------------------------------ carte

function QuickActions({ request }: { request: OrderRequest }) {
  const { setStatus, isPending } = useSetStatus()
  const next = nextStatus(request.status)
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    fn()
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {request.status === 'nouvelle' ? (
        <>
          <button type="button" className="btn btn-primary btn-sm" disabled={isPending} onClick={stop(() => void setStatus(request, 'acceptee'))}>
            <Check size={15} aria-hidden="true" />
            Accepter
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={isPending} onClick={stop(() => void setStatus(request, 'refusee'))}>
            <X size={15} aria-hidden="true" />
            Refuser
          </button>
        </>
      ) : (
        next && (
          <button type="button" className="btn btn-outline btn-sm" disabled={isPending} onClick={stop(() => void setStatus(request, next))}>
            <ArrowRight size={15} aria-hidden="true" />
            {STATUS[next].label}
          </button>
        )
      )}
      <CopyButton text={request.email} label="Email" className="btn btn-ghost btn-sm" />
    </div>
  )
}

function RequestCard({ request: r, actions, lead }: { request: OrderRequest; actions?: boolean; lead?: ReactNode }) {
  return (
    <div className="card flex min-w-0 items-stretch gap-1 !rounded-2xl p-3">
      {lead}
      <div className="min-w-0 flex-1">
        <Link to={`/admin/demandes/${r.id}`} className="group block">
          <div className="flex items-start justify-between gap-2">
            <p className="group-hover:text-rose min-w-0 truncate font-extrabold">{r.subject}</p>
            <div className="flex shrink-0 items-center gap-1">
              <BoostChip boost={r.boost} />
              <StatusChip status={r.status} />
            </div>
          </div>
          <p className="text-ink-soft mt-0.5 flex flex-wrap items-center gap-x-3 text-sm">
            <span className="font-semibold">{r.name}</span>
            <span className="inline-flex items-center gap-1">
              <Ruler size={13} aria-hidden="true" />
              {r.size_cm} cm
            </span>
            <span className="tabular text-ink font-bold">{euro(revenueOf(r))}</span>
            <span>{dateFr(r.created_at)}</span>
          </p>
        </Link>
        {actions && (
          <div className="mt-2">
            <QuickActions request={r} />
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ file d'attente

function SortableItem({ request, position }: { request: OrderRequest; position: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: request.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-90 drop-shadow-xl' : ''}
    >
      <RequestCard
        request={request}
        actions
        lead={
          <div className="flex items-center gap-1 pr-1.5">
            <button
              type="button"
              className="text-ink-soft hover:bg-rose-soft hover:text-rose grid h-full min-h-11 w-8 cursor-grab touch-none place-items-center rounded-xl active:cursor-grabbing"
              aria-label={`Déplacer ${request.subject} dans la file`}
              {...attributes}
              {...listeners}
            >
              <GripVertical size={18} />
            </button>
            <span className="font-display tabular text-rose w-7 text-center text-2xl font-semibold">{position}</span>
          </div>
        }
      />
    </li>
  )
}

function QueueView({ requests }: { requests: OrderRequest[] }) {
  const sensors = useDndSensors()
  const order = useQueueOrder()
  const queue = useMemo(() => sortQueue(requests), [requests])
  const fresh = requests
    .filter((r) => r.status === 'nouvelle')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const manual = queue.some((r) => r.manual_order != null)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = queue.map((r) => r.id)
    order.mutate(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="queue-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="queue-title" className="text-lg font-semibold">
            File d’attente <span className="text-ink-soft text-base font-medium">· {queue.length}</span>
          </h2>
          {manual && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => order.mutate(null)} disabled={order.isPending}>
              <RotateCcw size={15} aria-hidden="true" />
              Revenir à l’ordre automatique
            </button>
          )}
        </div>
        <p className="text-ink-soft mb-3 text-sm">
          {manual
            ? 'Ordre manuel actif : les demandes acceptées ensuite se placent à la fin, jusqu’au retour à l’ordre automatique.'
            : 'Ordre automatique : plus gros boost d’abord, puis demande la plus ancienne. Fais glisser la poignée pour ajuster.'}
        </p>
        <ErrorNote error={order.error} />
        {queue.length === 0 ? (
          <Empty title="La file est vide">Accepte une demande pour la faire entrer dans la file.</Empty>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={queue.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2.5">
                {queue.map((r, i) => (
                  <SortableItem key={r.id} request={r} position={i + 1} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <section aria-labelledby="new-title">
        <h2 id="new-title" className="mb-3 text-lg font-semibold">
          À traiter <span className="text-ink-soft text-base font-medium">· {fresh.length}</span>
        </h2>
        {fresh.length === 0 ? (
          <Empty title="Tout est traité" />
        ) : (
          <div className="space-y-2.5">
            {fresh.map((r) => (
              <RequestCard key={r.id} request={r} actions />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ liste

function ListView({ requests }: { requests: OrderRequest[] }) {
  const [filter, setFilter] = useState<'actives' | 'toutes' | RequestStatus>('actives')
  const [search, setSearch] = useState('')

  const shown = requests.filter((r) => {
    if (filter === 'actives' && ['payee', 'refusee', 'annulee'].includes(r.status)) return false
    if (filter !== 'actives' && filter !== 'toutes' && r.status !== filter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [r.subject, r.name, r.email, r.tracking_code, r.instagram ?? ''].some((f) => f.toLowerCase().includes(q))
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search size={17} className="text-ink-soft absolute top-1/2 left-4 -translate-y-1/2" aria-hidden="true" />
          <input
            className="input !py-2 !pl-11"
            type="search"
            placeholder="Chercher : sujet, prénom, email, code…"
            aria-label="Chercher une demande"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input !w-auto !py-2 font-bold"
          aria-label="Filtrer par statut"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
        >
          <option value="actives">Actives</option>
          <option value="toutes">Toutes</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
      </div>
      {shown.length === 0 ? (
        <Empty title="Aucune demande ne correspond" />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {shown.map((r) => (
            <RequestCard key={r.id} request={r} actions />
          ))}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ kanban

function KanbanCardBody({ request: r }: { request: OrderRequest }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[15px] font-extrabold">{r.subject}</p>
        <BoostChip boost={r.boost} />
      </div>
      <p className="text-ink-soft mt-0.5 text-sm">
        {r.name} · {r.size_cm} cm · <span className="tabular text-ink font-bold">{euro(revenueOf(r))}</span>
      </p>
    </>
  )
}

function KanbanCard({ request }: { request: OrderRequest }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: request.id })
  return (
    <Link
      ref={setNodeRef}
      to={`/admin/demandes/${request.id}`}
      draggable={false}
      className={`border-line bg-paper hover:border-rose-mid block rounded-2xl border-2 p-3 ${isDragging ? 'opacity-30' : ''}`}
      {...attributes}
      {...listeners}
    >
      <KanbanCardBody request={request} />
    </Link>
  )
}

function KanbanColumn({ status, requests }: { status: RequestStatus; requests: OrderRequest[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      aria-label={STATUS[status].label}
      className={`flex w-64 shrink-0 snap-start flex-col rounded-3xl p-2.5 transition-colors ${isOver ? 'bg-rose-soft' : 'bg-stone-soft/70'}`}
    >
      <h3 className="flex items-center justify-between px-1.5 pb-2 font-sans text-sm font-extrabold">
        <StatusChip status={status} />
        <span className="text-ink-soft tabular">{requests.length}</span>
      </h3>
      <div className="min-h-16 flex-1 space-y-2">
        {requests.map((r) => (
          <KanbanCard key={r.id} request={r} />
        ))}
      </div>
    </section>
  )
}

function KanbanView({ requests }: { requests: OrderRequest[] }) {
  const sensors = useDndSensors()
  const { setStatus, error } = useSetStatus()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragging = requests.find((r) => r.id === draggingId)

  const byStatus = (s: RequestStatus) => {
    const list = requests.filter((r) => r.status === s)
    // Acceptées / en cours : dans l'ordre de la file. Le reste : plus récent d'abord.
    return s === 'acceptee' || s === 'en_cours' ? sortQueue(list) : list
  }

  return (
    <div>
      <p className="text-ink-soft mb-3 text-sm">Fais glisser une carte vers une autre colonne pour changer son statut.</p>
      <ErrorNote error={error} />
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={(e) => setDraggingId(String(e.active.id))}
        onDragCancel={() => setDraggingId(null)}
        onDragEnd={({ active, over }) => {
          setDraggingId(null)
          const r = requests.find((x) => x.id === active.id)
          if (r && over && over.id !== r.status) void setStatus(r, over.id as RequestStatus)
        }}
      >
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4">
          {ALL_STATUSES.map((s) => (
            <KanbanColumn key={s} status={s} requests={byStatus(s)} />
          ))}
        </div>
        <DragOverlay>
          {dragging && (
            <div className="border-rose-mid bg-paper w-60 rotate-2 rounded-2xl border-2 p-3 shadow-xl">
              <KanbanCardBody request={dragging} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
