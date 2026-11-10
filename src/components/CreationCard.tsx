import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Ruler } from 'lucide-react'
import type { Creation } from '../lib/types'
import { creationPhotoUrl } from '../lib/supabase'
import { duration, euro } from '../lib/format'
import { Logo } from './ui'

export default function CreationCard({ creation }: { creation: Creation }) {
  const [index, setIndex] = useState(0)
  const photos = creation.photos
  const many = photos.length > 1
  const go = (delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length)

  return (
    <article className="card stitch overflow-hidden">
      <div className="bg-rose-soft relative aspect-square">
        {photos.length > 0 ? (
          <img
            src={creationPhotoUrl(photos[index])}
            alt={`${creation.name} — photo ${index + 1}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center opacity-60">
            <Logo size={72} />
          </div>
        )}
        {many && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Photo précédente"
              className="bg-paper/90 text-ink absolute top-1/2 left-3 z-10 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full shadow"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Photo suivante"
              className="bg-paper/90 text-ink absolute top-1/2 right-3 z-10 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full shadow"
            >
              <ChevronRight size={18} />
            </button>
            <span className="bg-ink/60 absolute right-3 bottom-3 rounded-full px-2 py-0.5 text-xs font-bold text-white">
              {index + 1}/{photos.length}
            </span>
          </>
        )}
      </div>
      <div className="p-4 pb-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg leading-snug font-semibold">{creation.name}</h3>
          {creation.final_price != null && (
            <span className="font-display text-rose text-lg font-semibold whitespace-nowrap">
              {euro(creation.final_price)}
            </span>
          )}
        </div>
        <div className="text-ink-soft mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
          {creation.size_cm != null && (
            <span className="inline-flex items-center gap-1">
              <Ruler size={14} aria-hidden="true" />
              {creation.size_cm} cm
            </span>
          )}
          {creation.show_time && creation.make_minutes != null && creation.make_minutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock size={14} aria-hidden="true" />
              {duration(creation.make_minutes * 60000)} de travail
            </span>
          )}
        </div>
        {creation.description && <p className="text-ink-soft mt-2 text-sm">{creation.description}</p>}
      </div>
    </article>
  )
}
