import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Loader2, Search } from 'lucide-react'
import { fetchTracking } from '../lib/api'
import { FLOW, STATUS, type TrackingInfo } from '../lib/types'
import { dateFr, friendlyError } from '../lib/format'
import { BoostChip, ErrorNote, StatusChip } from '../components/ui'

export default function Track() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('code') ?? ''
  const [code, setCode] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<TrackingInfo | null>(null)

  const lookup = async (raw: string) => {
    const clean = raw.trim().toUpperCase()
    if (!clean) return
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const result = await fetchTracking(clean)
      if (!result) setError('Aucune commande ne correspond à ce code. Vérifie qu’il est bien de la forme NW-XXXXX.')
      else setInfo(result)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initial) void lookup(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setParams(code.trim() ? { code: code.trim().toUpperCase() } : {}, { replace: true })
    void lookup(code)
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow">Suivi</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Où en est ma peluche ?</h1>
      <p className="text-ink-soft mt-2">Saisis le code de suivi reçu après ta demande.</p>

      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <input
          className="input tabular font-bold tracking-wider uppercase placeholder:font-semibold placeholder:tracking-normal placeholder:normal-case"
          placeholder="NW-7F3K2"
          aria-label="Code de suivi"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
          Voir
        </button>
      </form>

      <div className="mt-6" aria-live="polite">
        <ErrorNote error={error} />
        {info && <Result info={info} />}
      </div>
    </div>
  )
}

function Result({ info }: { info: TrackingInfo }) {
  const stepIndex = FLOW.indexOf(info.status)
  const stopped = stepIndex === -1 // refusée ou annulée

  return (
    <div className="card stitch p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display tabular text-xl font-semibold tracking-wide">{info.tracking_code}</span>
        <div className="flex items-center gap-1.5">
          <BoostChip boost={info.boost} />
          <StatusChip status={info.status} />
        </div>
      </div>
      <h2 className="mt-3 text-2xl font-semibold">
        {info.subject} <span className="text-ink-soft text-lg font-medium">· {info.size_cm} cm</span>
      </h2>
      <p className="mt-2">{STATUS[info.status].client}</p>

      {info.position != null && (
        <div className="bg-rose-soft mt-5 flex items-center gap-4 rounded-2xl p-4">
          <span className="font-display tabular text-rose text-5xl leading-none font-semibold">{info.position}</span>
          <p className="text-sm font-semibold">
            {info.position === 1 ? 'Tu es en tête de file !' : `Ta position dans la file, sur ${info.queue_length}.`}
            <span className="text-ink-soft block font-normal">
              La position peut bouger si une demande prioritaire arrive.
            </span>
          </p>
        </div>
      )}
      {info.status === 'nouvelle' && info.queue_length > 0 && (
        <p className="text-ink-soft mt-3 text-sm">
          {info.queue_length} commande{info.queue_length > 1 ? 's' : ''} dans la file en ce moment. Ta position
          s’affichera ici dès que ta demande sera acceptée.
        </p>
      )}

      {!stopped && (
        <ol className="relative z-10 mt-6 space-y-0">
          {FLOW.map((s, i) => {
            const done = i < stepIndex
            const current = i === stepIndex
            return (
              <li key={s} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                      done
                        ? 'border-sage bg-sage text-white'
                        : current
                          ? 'border-rose bg-rose text-white'
                          : 'border-line bg-paper'
                    }`}
                  >
                    {done && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                    {current && <span className="size-2 rounded-full bg-white" />}
                  </span>
                  {i < FLOW.length - 1 && <span className={`w-0.5 flex-1 ${done ? 'bg-sage' : 'bg-line'}`} />}
                </div>
                <p
                  className={`pb-4 text-[15px] ${current ? 'font-extrabold' : done ? 'font-semibold' : 'text-ink-soft'}`}
                  aria-current={current ? 'step' : undefined}
                >
                  {STATUS[s].label}
                </p>
              </li>
            )
          })}
        </ol>
      )}

      <dl className="border-line text-ink-soft mt-2 grid grid-cols-2 gap-2 border-t pt-4 text-sm">
        <div>
          <dt className="font-bold">Demande du</dt>
          <dd>{dateFr(info.created_at)}</dd>
        </div>
        <div>
          <dt className="font-bold">Dernière mise à jour</dt>
          <dd>{dateFr(info.updated_at)}</dd>
        </div>
      </dl>
    </div>
  )
}
