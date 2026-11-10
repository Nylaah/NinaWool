import { Link } from 'react-router-dom'
import { Pause, Play, Square } from 'lucide-react'
import { useRequests, useSessions, useSettings, useTimerActions } from '../lib/api'
import { clock, sessionMs, totalMs } from '../lib/format'
import { useNow } from '../hooks/useNow'

/** État du chrono, calculé à partir de la base : survit à la fermeture de l'app et au changement d'appareil. */
export function useTimerState() {
  const { data: sessions } = useSessions()
  const { data: settings } = useSettings()
  const active = sessions?.find((s) => s.ended_at == null) ?? null
  const pausedId = !active ? (settings?.paused_request_id ?? null) : null
  return { active, pausedId, sessions: sessions ?? [] }
}

/** Boutons Démarrer / Pause / Arrêter pour un projet donné. */
export function TimerControls({ requestId, compact }: { requestId: string; compact?: boolean }) {
  const { active, pausedId } = useTimerState()
  const { start, stop, busy } = useTimerActions()
  const running = active?.request_id === requestId
  const paused = pausedId === requestId
  const size = compact ? 'btn-sm' : ''

  if (running) {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn btn-outline ${size}`} disabled={busy} onClick={() => stop.mutate(true)}>
          <Pause size={16} aria-hidden="true" />
          Pause
        </button>
        <button type="button" className={`btn btn-primary ${size}`} disabled={busy} onClick={() => stop.mutate(false)}>
          <Square size={15} aria-hidden="true" />
          Arrêter
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={`btn btn-primary ${size}`} disabled={busy} onClick={() => start.mutate(requestId)}>
        <Play size={16} aria-hidden="true" />
        {paused ? 'Reprendre' : 'Démarrer'}
      </button>
      {paused && (
        <button type="button" className={`btn btn-outline ${size}`} disabled={busy} onClick={() => stop.mutate(false)}>
          <Square size={15} aria-hidden="true" />
          Arrêter
        </button>
      )}
    </div>
  )
}

/** Widget flottant visible sur toutes les pages admin. */
export default function TimerWidget() {
  const { active, pausedId, sessions } = useTimerState()
  const { data: requests } = useRequests()
  const now = useNow(Boolean(active))
  const requestId = active?.request_id ?? pausedId
  if (!requestId) return null

  const request = requests?.find((r) => r.id === requestId)
  const projectSessions = sessions.filter((s) => s.request_id === requestId)

  return (
    <aside
      aria-label="Chronomètre"
      className={`fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 w-[min(22rem,calc(100vw-1.5rem))] rounded-3xl p-3.5 shadow-xl md:right-5 md:bottom-5 ${
        active ? 'bg-ink text-white' : 'border-line bg-paper text-ink border-2'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <Link to={`/admin/demandes/${requestId}`} className="min-w-0 hover:underline">
          <p className={`text-xs font-extrabold tracking-wider uppercase ${active ? 'text-honey-mid' : 'text-ink-soft'}`}>
            {active ? '● Chrono en cours' : 'En pause'}
          </p>
          <p className="truncate font-bold">{request?.subject ?? 'Projet'}</p>
        </Link>
        <div className="text-right">
          <p className="font-display tabular text-2xl leading-tight font-semibold">
            {clock(active ? sessionMs(active, now) : 0)}
          </p>
          <p className={`tabular text-xs ${active ? 'text-white/70' : 'text-ink-soft'}`}>
            total {clock(totalMs(projectSessions, now))}
          </p>
        </div>
      </div>
      <div className={`mt-2.5 ${active ? '[&_.btn-outline]:text-ink' : ''}`}>
        <TimerControls requestId={requestId} compact />
      </div>
    </aside>
  )
}
