import { Link } from 'react-router-dom'
import { ArrowRight, HandCoins, MessageCircleHeart, PackageCheck, Zap } from 'lucide-react'
import { usePublicSettings, usePublishedCreations } from '../lib/api'
import CreationCard from '../components/CreationCard'
import { euro } from '../lib/format'

const STEPS = [
  {
    icon: MessageCircleHeart,
    title: 'Tu décris ta peluche',
    text: 'Un personnage, un animal, une taille, des couleurs… et le prix que tu proposes.',
  },
  {
    icon: PackageCheck,
    title: 'Nina la crochète',
    text: 'Ta demande entre dans la file. Tu suis son avancée avec ton code de suivi.',
  },
  {
    icon: HandCoins,
    title: 'Tu paies à la livraison',
    text: 'Aucun paiement en ligne. Tu règles seulement quand tu as ta peluche en main.',
  },
]

export default function Home() {
  const { data: creations } = usePublishedCreations()
  const { data: settings } = usePublicSettings()
  const latest = creations?.slice(0, 3) ?? []
  const ranges = [...(settings?.price_ranges ?? [])].sort((a, b) => a.max_cm - b.max_cm)

  return (
    <div className="space-y-16 sm:space-y-20">
      <section className="grid items-center gap-8 sm:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="eyebrow">Peluches au crochet · sur commande</p>
          <h1 className="mt-3 text-4xl leading-[1.05] font-semibold sm:text-6xl">
            Ta peluche,
            <br />
            <em className="text-rose font-medium">maille après maille.</em>
          </h1>
          <p className="text-ink-soft mt-5 max-w-md text-lg">
            Dis-moi quel personnage ou quel animal tu veux, à quelle taille, et je le crochète à la main rien que pour
            toi. Tu proposes ton prix, tu paies à la livraison.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/demande" className="btn btn-primary">
              Faire une demande
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/galerie" className="btn btn-outline">
              Voir les réalisations
            </Link>
          </div>
          {settings && !settings.orders_open && (
            <p className="bg-honey-soft mt-5 inline-block rounded-2xl px-4 py-2 text-sm font-semibold">
              {settings.closed_message}
            </p>
          )}
          {settings?.orders_open && settings.queue_length > 0 && (
            <p className="text-ink-soft mt-5 text-sm font-semibold">
              {settings.queue_length} peluche{settings.queue_length > 1 ? 's' : ''} dans la file en ce moment.
            </p>
          )}
        </div>
        <YarnIllustration />
      </section>

      <section aria-labelledby="etapes">
        <h2 id="etapes" className="text-2xl font-semibold sm:text-3xl">
          Comment ça marche
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="bg-rose-soft text-rose grid size-11 place-items-center rounded-2xl">
                  <s.icon size={22} aria-hidden="true" />
                </span>
                <span className="font-display text-line text-4xl font-semibold" aria-hidden="true">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="text-ink-soft mt-1 text-[15px]">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {latest.length > 0 && (
        <section aria-labelledby="dernieres">
          <div className="flex items-end justify-between gap-4">
            <h2 id="dernieres" className="text-2xl font-semibold sm:text-3xl">
              Dernières réalisations
            </h2>
            <Link to="/galerie" className="text-rose text-sm font-bold whitespace-nowrap hover:underline">
              Toute la galerie →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((c) => (
              <CreationCard key={c.id} creation={c} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {ranges.length > 0 && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold">Prix libre, repères indicatifs</h2>
            <p className="text-ink-soft mt-1 text-[15px]">
              C’est toi qui proposes le prix. Pour t’aider, voici ce que les gens donnent en général selon la taille.
            </p>
            <table className="mt-4 w-full text-[15px]">
              <tbody>
                {ranges.map((r, i) => (
                  <tr key={r.max_cm} className="border-line border-t">
                    <td className="py-2 font-semibold">
                      {i === 0 ? `Jusqu’à ${r.max_cm} cm` : `${ranges[i - 1].max_cm + 1} à ${r.max_cm} cm`}
                    </td>
                    <td className="tabular text-rose py-2 text-right font-bold">
                      {euro(r.min)} – {euro(r.max)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card bg-honey-soft/60 p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Zap size={20} className="text-honey" aria-hidden="true" />
            Pressé·e ? L’option prioritaire
          </h2>
          <p className="text-ink-soft mt-1 text-[15px]">
            Tu peux ajouter un supplément libre à ta demande. Les demandes avec le plus gros supplément passent en
            premier dans la file ; à supplément égal, c’est la plus ancienne qui passe d’abord. Comme le reste, il se
            règle à la livraison.
          </p>
        </div>
      </section>
    </div>
  )
}

/** Petite pelote dessinée, pour l'en-tête. */
function YarnIllustration() {
  return (
    <svg viewBox="0 0 320 280" className="mx-auto w-full max-w-xs sm:max-w-sm" role="img" aria-label="Une pelote de laine et un crochet">
      <ellipse cx="160" cy="252" rx="110" ry="12" fill="#33272A" opacity="0.07" />
      <circle cx="150" cy="140" r="104" fill="#D4607A" />
      <g fill="none" stroke="#FAE3E8" strokeWidth="5" strokeLinecap="round" opacity="0.9">
        <path d="M58 110c44-40 132-44 184-2" />
        <path d="M48 150c52-46 150-44 204 6" />
        <path d="M62 196c44-32 124-34 172-2" />
        <path d="M118 42c-30 56-30 138 6 196" />
        <path d="M176 40c34 54 36 140 0 200" />
        <path d="M84 70c50 20 110 90 130 150" opacity="0.6" />
      </g>
      <path
        d="M236 206c30 22 44 4 58 20s-6 32 14 40"
        fill="none"
        stroke="#B8405E"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <g transform="rotate(32 250 70)">
        <rect x="244" y="20" width="10" height="150" rx="5" fill="#E2A632" />
        <path d="M249 20c-9-2-12-12-5-17" fill="none" stroke="#E2A632" strokeWidth="6" strokeLinecap="round" />
        <rect x="244" y="96" width="10" height="46" rx="5" fill="#B07A10" opacity="0.55" />
      </g>
    </svg>
  )
}
