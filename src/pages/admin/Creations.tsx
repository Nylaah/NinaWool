import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAllCreations, useDeleteCreation, useRequests, useSaveCreation, useSessions } from '../../lib/api'
import { creationPhotoUrl, supabase } from '../../lib/supabase'
import type { Creation } from '../../lib/types'
import { duration, euro, revenueOf, totalMs } from '../../lib/format'
import { Empty, ErrorNote, Field, Logo, Modal, PageTitle, Spinner } from '../../components/ui'

type Draft = Partial<Creation>

export default function Creations() {
  const { data: creations, isLoading, error } = useAllCreations()
  const { data: requests } = useRequests()
  const { data: sessions } = useSessions()
  const save = useSaveCreation()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Draft | null>(null)

  // Arrivée depuis une fiche demande : « Ajouter à la galerie » pré-remplit le formulaire.
  const fromId = params.get('depuis')
  useEffect(() => {
    if (!fromId || !requests || !sessions) return
    const r = requests.find((x) => x.id === fromId)
    if (r) {
      const minutes = Math.round(totalMs(sessions.filter((s) => s.request_id === r.id && s.ended_at)) / 60000)
      setEditing({
        name: r.subject,
        size_cm: r.size_cm,
        final_price: revenueOf(r),
        make_minutes: minutes || null,
        request_id: r.id,
        show_time: false,
        published: false,
        photos: [],
      })
    }
    setParams({}, { replace: true })
  }, [fromId, requests, sessions, setParams])

  if (isLoading) return <Spinner />
  if (error) return <ErrorNote error={error} />

  return (
    <div>
      <PageTitle title="Galerie des réalisations">
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ photos: [], published: false, show_time: false })}>
          <Plus size={18} aria-hidden="true" />
          Nouvelle réalisation
        </button>
      </PageTitle>
      <p className="text-ink-soft -mt-2 mb-5 text-sm">Seules les réalisations « publiées » sont visibles sur le site.</p>
      <ErrorNote error={save.error} />

      {!creations?.length ? (
        <Empty title="Aucune réalisation">Ajoute tes premières peluches avec leurs photos.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {creations.map((c) => (
            <div key={c.id} className="card flex min-w-0 gap-3 !rounded-2xl p-3">
              <div className="bg-rose-soft grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl">
                {c.photos[0] ? (
                  <img src={creationPhotoUrl(c.photos[0])} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Logo size={32} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{c.name}</p>
                <p className="text-ink-soft text-sm">
                  {[c.size_cm != null && `${c.size_cm} cm`, c.final_price != null && euro(c.final_price), c.make_minutes && duration(c.make_minutes * 60000)]
                    .filter(Boolean)
                    .join(' · ') || 'Aucune info'}
                </p>
                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    aria-pressed={c.published}
                    disabled={save.isPending}
                    onClick={() => save.mutate({ creation: { id: c.id, photos: c.photos, published: !c.published }, newPhotos: [] })}
                    className={`chip min-h-8 cursor-pointer ${c.published ? 'bg-sage-soft text-sage' : 'bg-stone-soft text-stone'}`}
                  >
                    {c.published ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
                    {c.published ? 'Publiée' : 'Brouillon'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm !min-h-8 !px-2" aria-label={`Modifier ${c.name}`} onClick={() => setEditing(c)}>
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <CreationModal draft={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CreationModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const save = useSaveCreation()
  const del = useDeleteCreation()
  const [name, setName] = useState(draft.name ?? '')
  const [description, setDescription] = useState(draft.description ?? '')
  const [size, setSize] = useState(draft.size_cm != null ? String(draft.size_cm) : '')
  const [price, setPrice] = useState(draft.final_price != null ? String(draft.final_price) : '')
  const [hours, setHours] = useState(draft.make_minutes ? String(Math.floor(draft.make_minutes / 60)) : '')
  const [minutes, setMinutes] = useState(draft.make_minutes ? String(draft.make_minutes % 60) : '')
  const [showTime, setShowTime] = useState(draft.show_time ?? false)
  const [published, setPublished] = useState(draft.published ?? false)
  const [photos, setPhotos] = useState<string[]>(draft.photos ?? [])
  const [removed, setRemoved] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])

  const previews = useMemo(() => newPhotos.map((f) => URL.createObjectURL(f)), [newPhotos])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const totalMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0)
    await save.mutateAsync({
      creation: {
        ...(draft.id ? { id: draft.id } : {}),
        name: name.trim(),
        description: description.trim() || null,
        size_cm: size === '' ? null : Number(size),
        final_price: price === '' ? null : Number(price),
        make_minutes: totalMinutes || null,
        show_time: showTime,
        published,
        photos,
        request_id: draft.request_id ?? null,
      },
      newPhotos,
    })
    if (removed.length) await supabase.storage.from('creations').remove(removed)
    onClose()
  }

  return (
    <Modal title={draft.id ? 'Modifier la réalisation' : 'Nouvelle réalisation'} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nom">
          <input className="input" required maxLength={120} placeholder="Évoli" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taille (cm)" optional>
            <input className="input tabular" type="number" min={1} max={300} inputMode="numeric" value={size} onChange={(e) => setSize(e.target.value)} />
          </Field>
          <Field label="Prix final payé (€)" optional>
            <input className="input tabular" type="number" min={0} step="0.5" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
        <div>
          <span className="label">Temps de fabrication</span>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input tabular !w-20" type="number" min={0} inputMode="numeric" aria-label="Heures" value={hours} onChange={(e) => setHours(e.target.value)} />
            <span className="text-ink-soft font-bold">h</span>
            <input className="input tabular !w-20" type="number" min={0} max={59} inputMode="numeric" aria-label="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <span className="text-ink-soft font-bold">min</span>
            <label className="ml-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="accent-rose size-5" checked={showTime} onChange={(e) => setShowTime(e.target.checked)} />
              Afficher sur le site
            </label>
          </div>
        </div>
        <Field label="Description" optional>
          <textarea className="input min-h-20" maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div>
          <span className="label">Photos</span>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <Thumb
                key={p}
                src={creationPhotoUrl(p)}
                onRemove={() => {
                  setPhotos((list) => list.filter((x) => x !== p))
                  setRemoved((list) => [...list, p])
                }}
              />
            ))}
            {previews.map((u, i) => (
              <Thumb key={u} src={u} onRemove={() => setNewPhotos((list) => list.filter((_, j) => j !== i))} />
            ))}
            <label className="border-line text-ink-soft hover:border-rose-mid hover:text-rose grid size-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed">
              <ImagePlus size={22} aria-hidden="true" />
              <span className="sr-only">Ajouter des photos</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  setNewPhotos((list) => [...list, ...Array.from(e.target.files ?? [])])
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          <p className="hint">La première photo sert de couverture. Les photos sont allégées automatiquement avant l’envoi.</p>
        </div>

        <label className="bg-sage-soft flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 font-bold">
          <input type="checkbox" className="accent-sage size-5" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publier sur le site
        </label>

        <ErrorNote error={save.error ?? del.error} />
        <div className="flex flex-wrap justify-between gap-2">
          {draft.id ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={del.isPending}
              onClick={async () => {
                if (!confirm(`Supprimer « ${draft.name} » et ses photos ?`)) return
                await del.mutateAsync(draft as Creation)
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
            {save.isPending ? 'Envoi des photos…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative size-20">
      <img src={src} alt="" className="size-20 rounded-xl object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Retirer cette photo"
        className="bg-ink absolute -top-1.5 -right-1.5 grid size-7 cursor-pointer place-items-center rounded-full text-white shadow"
      >
        <X size={14} />
      </button>
    </div>
  )
}
