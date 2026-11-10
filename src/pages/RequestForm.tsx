import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ImagePlus, Loader2, PartyPopper, Send, X, Zap } from 'lucide-react'
import { submitRequest, usePublicSettings, type RequestFormValues } from '../lib/api'
import { euro, friendlyError, rangeForSize, todayIso } from '../lib/format'
import { CopyButton, ErrorNote, Field, Spinner } from '../components/ui'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const EMPTY: RequestFormValues = {
  name: '',
  email: '',
  instagram: '',
  phone: '',
  subject: '',
  size_cm: 30,
  details: '',
  proposed_price: 0,
  boost: 0,
  desired_date: '',
  payment_ack: false,
  website: '',
  image: null,
}

export default function RequestForm() {
  const { data: settings, isLoading } = usePublicSettings()
  const [v, setV] = useState<RequestFormValues>(EMPTY)
  const [price, setPrice] = useState('')
  const [boost, setBoost] = useState('')
  const [imageError, setImageError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)

  const set = <K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) =>
    setV((old) => ({ ...old, [key]: value }))

  const preview = useMemo(() => (v.image ? URL.createObjectURL(v.image) : null), [v.image])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const range = settings ? rangeForSize(settings.price_ranges, v.size_cm) : null

  const onImage = (file: File | undefined) => {
    setImageError(null)
    if (!file) return set('image', null)
    if (!IMAGE_TYPES.includes(file.type)) return setImageError('Format accepté : JPG, PNG ou WebP.')
    if (file.size > MAX_IMAGE_BYTES) return setImageError('L’image dépasse 5 Mo. Choisis-en une plus légère.')
    set('image', file)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const result = await submitRequest({ ...v, proposed_price: Number(price), boost: Number(boost) || 0 })
      setCode(result)
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSending(false)
    }
  }

  if (code) return <Confirmation code={code} />
  if (isLoading) return <Spinner />

  if (settings && !settings.orders_open) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-semibold">Les commandes sont en pause</h1>
        <p className="text-ink-soft mt-2">{settings.closed_message}</p>
        <Link to="/galerie" className="btn btn-outline mt-6">
          Voir la galerie en attendant
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">Commande sur mesure</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Faire une demande</h1>
      <p className="text-ink-soft mt-2">
        Par exemple : « un Évoli d’environ 30 cm ». Plus tu donnes de détails, plus la peluche te ressemblera.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <fieldset className="card space-y-5 p-5 sm:p-6">
          <legend className="font-display float-left mb-1 w-full text-xl font-semibold">Toi</legend>
          <Field label="Prénom ou pseudo">
            <input
              className="input"
              required
              maxLength={80}
              autoComplete="given-name"
              value={v.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
          <Field label="Email" hint="Pour te répondre et organiser la livraison. Il ne sera jamais affiché.">
            <input
              className="input"
              type="email"
              required
              maxLength={200}
              autoComplete="email"
              placeholder="toi@exemple.fr"
              value={v.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Instagram" optional>
              <input
                className="input"
                maxLength={100}
                placeholder="@tonpseudo"
                value={v.instagram}
                onChange={(e) => set('instagram', e.target.value)}
              />
            </Field>
            <Field label="Téléphone" optional>
              <input
                className="input"
                type="tel"
                maxLength={40}
                autoComplete="tel"
                value={v.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
          </div>
          {/* Piège à robots : invisible pour les humains, doit rester vide. */}
          <div className="absolute -left-[9999px] h-0 overflow-hidden" aria-hidden="true">
            <label>
              Ne pas remplir ce champ
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={v.website}
                onChange={(e) => set('website', e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="card space-y-5 p-5 sm:p-6">
          <legend className="font-display float-left mb-1 w-full text-xl font-semibold">Ta peluche</legend>
          <Field label="Personnage ou animal">
            <input
              className="input"
              required
              maxLength={200}
              placeholder="Évoli, un renard roux, mon chat Pixel…"
              value={v.subject}
              onChange={(e) => set('subject', e.target.value)}
            />
          </Field>

          <div>
            <label htmlFor="size-range" className="label">
              Taille souhaitée
            </label>
            <div className="flex items-center gap-4">
              <input
                id="size-range"
                type="range"
                min={10}
                max={60}
                step={1}
                value={Math.min(60, Math.max(10, v.size_cm))}
                onChange={(e) => set('size_cm', Number(e.target.value))}
                className="h-11 flex-1"
              />
              <div className="relative w-28 shrink-0">
                <input
                  type="number"
                  min={5}
                  max={200}
                  required
                  aria-label="Taille en centimètres"
                  value={v.size_cm || ''}
                  onChange={(e) => set('size_cm', Number(e.target.value))}
                  className="input tabular !pr-11 text-right font-bold"
                />
                <span className="text-ink-soft pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-bold">
                  cm
                </span>
              </div>
            </div>
            <p className="hint">Le curseur va de 10 à 60 cm. Pour une autre taille, écris-la directement dans la case.</p>
          </div>

          <Field label="Couleurs et détails particuliers" optional>
            <textarea
              className="input min-h-28"
              maxLength={4000}
              placeholder="Couleurs précises, expression, accessoires, yeux brodés ou de sécurité…"
              value={v.details}
              onChange={(e) => set('details', e.target.value)}
            />
          </Field>

          <div>
            <span className="label">
              Image de référence <span className="text-ink-soft font-semibold">· facultatif</span>
            </span>
            {preview ? (
              <div className="border-line flex items-center gap-4 rounded-2xl border-2 p-3">
                <img src={preview} alt="Aperçu de l’image de référence" className="size-20 rounded-xl object-cover" />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{v.image?.name}</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onImage(undefined)}>
                  <X size={16} aria-hidden="true" />
                  Retirer
                </button>
              </div>
            ) : (
              <label className="border-line text-ink-soft hover:border-rose-mid hover:text-rose flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-sm font-bold transition">
                <ImagePlus size={20} aria-hidden="true" />
                Choisir une image (JPG, PNG, WebP · 5 Mo max)
                <input
                  type="file"
                  accept={IMAGE_TYPES.join(',')}
                  className="sr-only"
                  onChange={(e) => {
                    onImage(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            )}
            {imageError && (
              <p role="alert" className="text-rose-deep mt-1.5 text-sm font-semibold">
                {imageError}
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="card space-y-5 p-5 sm:p-6">
          <legend className="font-display float-left mb-1 w-full text-xl font-semibold">Prix et délai</legend>
          <Field
            label="Prix que tu proposes (€)"
            hint={
              range ? (
                <>
                  Repère pour {v.size_cm} cm : entre <strong>{euro(range.min)}</strong> et{' '}
                  <strong>{euro(range.max)}</strong>. Le prix reste libre.
                </>
              ) : (
                'Le prix est libre : propose ce qui te semble juste.'
              )
            }
          >
            <input
              className="input tabular"
              type="number"
              inputMode="decimal"
              required
              min={0}
              step="0.5"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>

          <div className="bg-honey-soft/60 rounded-2xl p-4">
            <Field label="Supplément prioritaire (€)" optional>
              <input
                className="input tabular"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                placeholder="0"
                value={boost}
                onChange={(e) => setBoost(e.target.value)}
              />
            </Field>
            <p className="text-ink mt-2.5 flex gap-2 text-sm">
              <Zap size={16} className="text-honey mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Envie de passer devant ? Ajoute un supplément. La file est triée du plus gros supplément au plus petit,
                puis de la demande la plus ancienne à la plus récente. Il s’ajoute au prix proposé et se règle aussi à
                la livraison.
              </span>
            </p>
          </div>

          <Field label="Date souhaitée" optional hint="Indicative : je fais de mon mieux, sans garantie.">
            <input
              className="input"
              type="date"
              min={todayIso()}
              value={v.desired_date}
              onChange={(e) => set('desired_date', e.target.value)}
            />
          </Field>
        </fieldset>

        <label className="card flex cursor-pointer items-start gap-3 p-5">
          <input
            type="checkbox"
            required
            checked={v.payment_ack}
            onChange={(e) => set('payment_ack', e.target.checked)}
            className="accent-rose mt-0.5 size-5 shrink-0"
          />
          <span className="font-semibold">
            J’ai compris que le paiement se fait à la livraison
            <span className="text-ink-soft block text-sm font-normal">
              Rien à payer maintenant, aucun paiement en ligne.
              {Number(price) > 0 && (
                <>
                  {' '}
                  Total à la livraison : <strong>{euro(Number(price) + (Number(boost) || 0))}</strong>.
                </>
              )}
            </span>
          </span>
        </label>

        <ErrorNote error={error} />

        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={sending}>
          {sending ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
          {sending ? 'Envoi en cours…' : 'Envoyer ma demande'}
        </button>
      </form>
    </div>
  )
}

function Confirmation({ code }: { code: string }) {
  return (
    <div className="card stitch mx-auto max-w-xl p-8 text-center sm:p-10">
      <PartyPopper size={36} className="text-rose mx-auto" aria-hidden="true" />
      <h1 className="mt-3 text-3xl font-semibold">Demande envoyée !</h1>
      <p className="text-ink-soft mt-2">Voici ton code de suivi. Note-le ou fais une capture d’écran :</p>
      <p className="font-display tabular text-rose bg-rose-soft mx-auto mt-5 w-fit rounded-2xl px-6 py-3 text-4xl font-semibold tracking-wider select-all">
        {code}
      </p>
      <p className="mt-4 text-sm font-bold">
        Conserve-le précieusement : c’est le seul moyen de suivre ta commande.
      </p>
      <div className="relative z-10 mt-6 flex flex-wrap justify-center gap-3">
        <CopyButton text={code} label="Copier le code" className="btn btn-outline" />
        <Link to={`/suivi?code=${code}`} className="btn btn-primary">
          Suivre ma commande
        </Link>
      </div>
      <p className="text-ink-soft mt-6 text-sm">
        Nina va lire ta demande et te répondre par email. Paiement à la livraison uniquement.
      </p>
    </div>
  )
}
