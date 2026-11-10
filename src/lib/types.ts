export type RequestStatus =
  | 'nouvelle'
  | 'acceptee'
  | 'en_cours'
  | 'terminee'
  | 'livree'
  | 'payee'
  | 'refusee'
  | 'annulee'

export interface StatusMeta {
  label: string
  /** classes Tailwind de la pastille */
  chip: string
  /** phrase affichée au client sur la page de suivi */
  client: string
}

export const STATUS: Record<RequestStatus, StatusMeta> = {
  nouvelle: {
    label: 'Nouvelle',
    chip: 'bg-sky-soft text-sky',
    client: 'Ta demande est bien arrivée. Nina va la lire et te répondre bientôt.',
  },
  acceptee: {
    label: 'Acceptée',
    chip: 'bg-plum-soft text-plum',
    client: 'Ta demande est acceptée ! Elle attend son tour dans la file.',
  },
  en_cours: {
    label: 'En cours',
    chip: 'bg-honey-soft text-honey',
    client: 'Ta peluche est en train de prendre forme, maille après maille.',
  },
  terminee: {
    label: 'Terminée',
    chip: 'bg-sage-soft text-sage',
    client: 'Ta peluche est terminée ! Nina te contacte pour organiser la livraison.',
  },
  livree: {
    label: 'Livrée',
    chip: 'bg-sage-soft text-sage',
    client: 'Ta peluche a été livrée. Prends-en bien soin !',
  },
  payee: {
    label: 'Payée',
    chip: 'bg-sage text-white',
    client: 'Commande livrée et réglée. Merci beaucoup !',
  },
  refusee: {
    label: 'Refusée',
    chip: 'bg-stone-soft text-stone',
    client: 'Nina ne peut malheureusement pas réaliser cette demande.',
  },
  annulee: {
    label: 'Annulée',
    chip: 'bg-stone-soft text-stone',
    client: 'Cette demande a été annulée.',
  },
}

/** Parcours normal d'une commande, dans l'ordre. */
export const FLOW: RequestStatus[] = ['nouvelle', 'acceptee', 'en_cours', 'terminee', 'livree', 'payee']
export const ALL_STATUSES: RequestStatus[] = [...FLOW, 'refusee', 'annulee']
/** Statuts qui comptent dans la file d'attente. */
export const QUEUE_STATUSES: RequestStatus[] = ['acceptee', 'en_cours']

export interface OrderRequest {
  id: string
  tracking_code: string
  name: string
  email: string
  instagram: string | null
  phone: string | null
  subject: string
  size_cm: number
  details: string | null
  reference_image_path: string | null
  proposed_price: number
  boost: number
  desired_date: string | null
  status: RequestStatus
  manual_order: number | null
  private_notes: string | null
  final_price: number | null
  created_at: string
  updated_at: string
}

export interface StatusHistoryEntry {
  id: number
  request_id: string
  old_status: RequestStatus | null
  new_status: RequestStatus
  changed_at: string
}

export interface WorkSession {
  id: string
  request_id: string
  started_at: string
  ended_at: string | null
  note: string | null
}

export const EXPENSE_CATEGORIES = ['laine', 'rembourrage', 'accessoires', 'outils', 'envoi', 'autre'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface Expense {
  id: string
  spent_on: string
  description: string
  category: string
  amount: number
  receipt_path: string | null
  request_id: string | null
  created_at: string
}

export interface Creation {
  id: string
  name: string
  description: string | null
  size_cm: number | null
  final_price: number | null
  make_minutes: number | null
  show_time: boolean
  published: boolean
  photos: string[]
  request_id: string | null
  created_at: string
}

export interface PriceRange {
  max_cm: number
  min: number
  max: number
}

export interface Settings {
  id: 1
  orders_open: boolean
  closed_message: string
  max_requests_per_day: number
  price_ranges: PriceRange[]
  hourly_goal: number
  paused_request_id: string | null
}

export interface PublicSettings {
  orders_open: boolean
  closed_message: string
  price_ranges: PriceRange[]
  queue_length: number
}

export interface TrackingInfo {
  tracking_code: string
  status: RequestStatus
  subject: string
  size_cm: number
  boost: number
  created_at: string
  updated_at: string
  position: number | null
  queue_length: number
}
