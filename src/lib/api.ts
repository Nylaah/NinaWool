import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { shrinkImage } from './format'
import type {
  Creation,
  Expense,
  OrderRequest,
  PublicSettings,
  RequestStatus,
  Settings,
  StatusHistoryEntry,
  TrackingInfo,
  WorkSession,
} from './types'

/** Lève l'erreur Supabase s'il y en a une, sinon renvoie les données. */
async function unwrap<T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data as T
}

// ---------------------------------------------------------------- public

export function usePublicSettings() {
  return useQuery({
    queryKey: ['public-settings'],
    queryFn: () => unwrap<PublicSettings>(supabase.rpc('get_public_settings')),
    staleTime: 60_000,
  })
}

export function usePublishedCreations() {
  return useQuery({
    queryKey: ['creations', 'published'],
    queryFn: () =>
      unwrap<Creation[]>(
        supabase.from('creations').select('*').eq('published', true).order('created_at', { ascending: false }),
      ),
    staleTime: 60_000,
  })
}

export async function fetchTracking(code: string): Promise<TrackingInfo | null> {
  return unwrap<TrackingInfo | null>(supabase.rpc('get_request_status', { p_code: code }))
}

export interface RequestFormValues {
  name: string
  email: string
  instagram: string
  phone: string
  subject: string
  size_cm: number
  details: string
  proposed_price: number
  boost: number
  desired_date: string
  payment_ack: boolean
  website: string
  image: File | null
}

export async function submitRequest(v: RequestFormValues): Promise<string> {
  let imagePath: string | null = null
  // Un robot pris au piège n'a pas besoin d'occuper du stockage.
  if (v.image && !v.website) {
    const blob = await shrinkImage(v.image)
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
    imagePath = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('references').upload(imagePath, blob, { contentType: blob.type })
    if (error) throw new Error(`L’image n’a pas pu être envoyée (${error.message}).`)
  }
  return unwrap<string>(
    supabase.rpc('submit_request', {
      p_name: v.name,
      p_email: v.email,
      p_subject: v.subject,
      p_size_cm: v.size_cm,
      p_proposed_price: v.proposed_price,
      p_payment_ack: v.payment_ack,
      p_instagram: v.instagram || null,
      p_phone: v.phone || null,
      p_details: v.details || null,
      p_reference_image_path: imagePath,
      p_boost: v.boost || 0,
      p_desired_date: v.desired_date || null,
      p_website: v.website || null,
    }),
  )
}

// ---------------------------------------------------------------- admin : lecture

export function useRequests() {
  return useQuery({
    queryKey: ['requests'],
    queryFn: () => unwrap<OrderRequest[]>(supabase.from('requests').select('*').order('created_at', { ascending: false })),
    refetchInterval: 60_000,
  })
}

export function useHistory(requestId: string | undefined) {
  return useQuery({
    queryKey: ['history', requestId],
    enabled: Boolean(requestId),
    queryFn: () =>
      unwrap<StatusHistoryEntry[]>(
        supabase.from('status_history').select('*').eq('request_id', requestId!).order('changed_at', { ascending: false }),
      ),
  })
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () =>
      unwrap<WorkSession[]>(supabase.from('work_sessions').select('*').order('started_at', { ascending: false })),
    refetchInterval: 30_000,
  })
}

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: () =>
      unwrap<Expense[]>(
        supabase.from('expenses').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false }),
      ),
  })
}

export function useAllCreations() {
  return useQuery({
    queryKey: ['creations', 'all'],
    queryFn: () => unwrap<Creation[]>(supabase.from('creations').select('*').order('created_at', { ascending: false })),
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => unwrap<Settings>(supabase.from('settings').select('*').eq('id', 1).single()),
    refetchInterval: 30_000,
  })
}

// ---------------------------------------------------------------- admin : écriture

/** Petit utilitaire : une mutation qui rafraîchit les listes concernées. */
function useInvalidatingMutation<V>(fn: (vars: V) => Promise<unknown>, keys: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

export function useUpdateRequest() {
  return useInvalidatingMutation(
    ({ id, patch }: { id: string; patch: Partial<OrderRequest> }) =>
      unwrap(supabase.from('requests').update(patch).eq('id', id).select('id')),
    ['requests', 'history', 'public-settings'],
  )
}

export function useSetStatus() {
  const update = useUpdateRequest()
  return {
    ...update,
    setStatus: (r: OrderRequest, status: RequestStatus) => {
      const patch: Partial<OrderRequest> = { status }
      // En passant à « payée », on fige le prix final s'il n'était pas renseigné.
      if (status === 'payee' && r.final_price == null) patch.final_price = Number(r.proposed_price) + Number(r.boost)
      return update.mutateAsync({ id: r.id, patch })
    },
  }
}

export function useDeleteRequest() {
  return useInvalidatingMutation(
    async (r: OrderRequest) => {
      if (r.reference_image_path) await supabase.storage.from('references').remove([r.reference_image_path])
      await unwrap(supabase.from('requests').delete().eq('id', r.id).select('id'))
    },
    ['requests', 'sessions', 'expenses', 'settings'],
  )
}

export function useQueueOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[] | null) =>
      unwrap(ids ? supabase.rpc('set_queue_order', { p_ids: ids }) : supabase.rpc('reset_queue_order')),
    // Mise à jour optimiste : la carte reste là où on l'a lâchée.
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ['requests'] })
      const previous = qc.getQueryData<OrderRequest[]>(['requests'])
      qc.setQueryData<OrderRequest[]>(['requests'], (old) =>
        old?.map((r) => {
          if (!ids) return { ...r, manual_order: null }
          const i = ids.indexOf(r.id)
          return i === -1 ? r : { ...r, manual_order: i + 1 }
        }),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['requests'], ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

const TIMER_KEYS = ['sessions', 'settings', 'requests', 'history']

export function useTimerActions() {
  const start = useInvalidatingMutation(
    (requestId: string) => unwrap(supabase.rpc('start_timer', { p_request_id: requestId })),
    TIMER_KEYS,
  )
  const stop = useInvalidatingMutation(
    (pause: boolean) => unwrap(supabase.rpc('stop_timer', { p_pause: pause })),
    TIMER_KEYS,
  )
  return { start, stop, busy: start.isPending || stop.isPending }
}

export function useSaveSession() {
  return useInvalidatingMutation(
    (s: Partial<WorkSession> & { request_id: string }) =>
      s.id
        ? unwrap(supabase.from('work_sessions').update(s).eq('id', s.id).select('id'))
        : unwrap(supabase.from('work_sessions').insert(s).select('id')),
    ['sessions'],
  )
}

export function useDeleteSession() {
  return useInvalidatingMutation(
    (id: string) => unwrap(supabase.from('work_sessions').delete().eq('id', id).select('id')),
    ['sessions'],
  )
}

async function uploadPhoto(bucket: 'creations' | 'receipts', file: File): Promise<string> {
  const blob = await shrinkImage(file)
  const path = `${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type || 'image/jpeg' })
  if (error) throw new Error(`Envoi de la photo impossible (${error.message}).`)
  return path
}

export function useSaveExpense() {
  return useInvalidatingMutation(
    async ({ expense, receipt }: { expense: Partial<Expense>; receipt: File | null }) => {
      const row = { ...expense }
      if (receipt) row.receipt_path = await uploadPhoto('receipts', receipt)
      return row.id
        ? unwrap(supabase.from('expenses').update(row).eq('id', row.id).select('id'))
        : unwrap(supabase.from('expenses').insert(row).select('id'))
    },
    ['expenses'],
  )
}

export function useDeleteExpense() {
  return useInvalidatingMutation(
    async (e: Expense) => {
      if (e.receipt_path) await supabase.storage.from('receipts').remove([e.receipt_path])
      await unwrap(supabase.from('expenses').delete().eq('id', e.id).select('id'))
    },
    ['expenses'],
  )
}

export function useSaveCreation() {
  return useInvalidatingMutation(
    async ({ creation, newPhotos }: { creation: Partial<Creation>; newPhotos: File[] }) => {
      const uploaded = await Promise.all(newPhotos.map((f) => uploadPhoto('creations', f)))
      const row = { ...creation, photos: [...(creation.photos ?? []), ...uploaded] }
      return row.id
        ? unwrap(supabase.from('creations').update(row).eq('id', row.id).select('id'))
        : unwrap(supabase.from('creations').insert(row).select('id'))
    },
    ['creations'],
  )
}

export function useDeleteCreation() {
  return useInvalidatingMutation(
    async (c: Creation) => {
      if (c.photos.length) await supabase.storage.from('creations').remove(c.photos)
      await unwrap(supabase.from('creations').delete().eq('id', c.id).select('id'))
    },
    ['creations'],
  )
}

export function useSaveSettings() {
  return useInvalidatingMutation(
    (patch: Partial<Settings>) => unwrap(supabase.from('settings').update(patch).eq('id', 1).select('id')),
    ['settings', 'public-settings'],
  )
}
