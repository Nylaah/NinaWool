import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublishedCreations } from '../lib/api'
import CreationCard from '../components/CreationCard'
import { Empty, ErrorNote, Spinner } from '../components/ui'

const SIZES = [
  { id: 'all', label: 'Toutes tailles', test: () => true },
  { id: 's', label: 'Moins de 20 cm', test: (cm: number) => cm < 20 },
  { id: 'm', label: '20 à 35 cm', test: (cm: number) => cm >= 20 && cm <= 35 },
  { id: 'l', label: 'Plus de 35 cm', test: (cm: number) => cm > 35 },
]

export default function Gallery() {
  const { data, isLoading, error } = usePublishedCreations()
  const [size, setSize] = useState('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const filtered = useMemo(() => {
    const sizeTest = SIZES.find((s) => s.id === size)!.test
    const min = minPrice === '' ? null : Number(minPrice)
    const max = maxPrice === '' ? null : Number(maxPrice)
    return (data ?? []).filter((c) => {
      if (size !== 'all' && (c.size_cm == null || !sizeTest(c.size_cm))) return false
      if (min != null && (c.final_price == null || c.final_price < min)) return false
      if (max != null && (c.final_price == null || c.final_price > max)) return false
      return true
    })
  }, [data, size, minPrice, maxPrice])

  const hasFilter = size !== 'all' || minPrice !== '' || maxPrice !== ''

  return (
    <div>
      <p className="eyebrow">Galerie</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Les réalisations</h1>
      <p className="text-ink-soft mt-2 max-w-xl">
        Quelques peluches déjà parties chez leurs propriétaires, avec leur taille et le prix payé.
      </p>

      <div className="card mt-6 flex flex-wrap items-end gap-x-6 gap-y-4 p-4">
        <div>
          <span className="label">Taille</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par taille">
            {SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={size === s.id}
                onClick={() => setSize(s.id)}
                className={`btn btn-sm ${size === s.id ? 'btn-primary' : 'btn-outline'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Prix (€)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="min"
              aria-label="Prix minimum"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="input !w-24 !py-1.5"
            />
            <span className="text-ink-soft">à</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="max"
              aria-label="Prix maximum"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="input !w-24 !py-1.5"
            />
          </div>
        </div>
        {hasFilter && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSize('all')
              setMinPrice('')
              setMaxPrice('')
            }}
          >
            Effacer les filtres
          </button>
        )}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorNote error="La galerie n’a pas pu être chargée. Réessaie dans un instant." />
        ) : filtered.length === 0 ? (
          <Empty title={hasFilter ? 'Rien ne correspond à ces filtres' : 'La galerie se remplit bientôt'}>
            {hasFilter ? (
              'Essaie d’élargir la taille ou la fourchette de prix.'
            ) : (
              <>
                En attendant,{' '}
                <Link to="/demande" className="text-rose font-bold hover:underline">
                  fais ta demande
                </Link>{' '}
                : la tienne sera peut-être la première !
              </>
            )}
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <CreationCard key={c.id} creation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
