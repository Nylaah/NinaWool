import type { OrderRequest, PriceRange, WorkSession } from './types'
import { QUEUE_STATUSES } from './types'

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const eurRound = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export function euro(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  return Number.isInteger(n) ? eurRound.format(n) : eur.format(n)
}

export function dateFr(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—'
  // Une date seule (YYYY-MM-DD) est lue en heure locale, pas en UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

/** 5400000 → « 1 h 30 » */
export function duration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  return `${h} h ${String(m).padStart(2, '0')}`
}

/** 5400000 → « 01:30:00 » (affichage du chrono) */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

export function sessionMs(s: WorkSession, now = Date.now()): number {
  return (s.ended_at ? new Date(s.ended_at).getTime() : now) - new Date(s.started_at).getTime()
}

export function totalMs(sessions: WorkSession[], now = Date.now()): number {
  return sessions.reduce((sum, s) => sum + sessionMs(s, now), 0)
}

/** Ce que rapporte une commande : prix final s'il est fixé, sinon prix proposé + boost. */
export function revenueOf(r: OrderRequest): number {
  return r.final_price != null ? Number(r.final_price) : Number(r.proposed_price) + Number(r.boost)
}

/** File d'attente : ordre manuel s'il existe, sinon boost décroissant puis date croissante. */
export function sortQueue(requests: OrderRequest[]): OrderRequest[] {
  return requests
    .filter((r) => QUEUE_STATUSES.includes(r.status))
    .sort((a, b) => {
      if (a.manual_order != null || b.manual_order != null) {
        if (a.manual_order == null) return 1
        if (b.manual_order == null) return -1
        if (a.manual_order !== b.manual_order) return a.manual_order - b.manual_order
      }
      if (Number(b.boost) !== Number(a.boost)) return Number(b.boost) - Number(a.boost)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
}

export function rangeForSize(ranges: PriceRange[], size: number): PriceRange | null {
  const sorted = [...ranges].sort((a, b) => a.max_cm - b.max_cm)
  return sorted.find((r) => size <= r.max_cm) ?? sorted[sorted.length - 1] ?? null
}

/** datetime-local <-> ISO */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function todayIso(): string {
  return toLocalInput(new Date().toISOString()).slice(0, 10)
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // BOM + point-virgule : s'ouvre proprement dans Excel/LibreOffice en français.
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Redimensionne une photo avant envoi (les photos de téléphone font souvent 5–10 Mo). */
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff' // les PNG transparents deviennent blancs, pas noirs
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    return blob ?? file
  } catch {
    return file
  }
}

export const ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMIT: 'Tu as déjà envoyé plusieurs demandes aujourd’hui avec cet email. Réessaie demain !',
  TOO_MANY_REQUESTS: 'Il y a beaucoup de demandes en ce moment. Réessaie dans une heure.',
  ORDERS_CLOSED: 'Les commandes sont fermées pour le moment.',
  PAYMENT_ACK_REQUIRED: 'Merci de cocher la case sur le paiement à la livraison.',
  INVALID_EMAIL: 'Cette adresse email ne semble pas valide.',
  INVALID_NAME: 'Indique ton prénom ou ton pseudo.',
  INVALID_SUBJECT: 'Indique le personnage ou l’animal souhaité.',
  INVALID_SIZE: 'La taille doit être comprise entre 5 et 200 cm.',
  INVALID_PRICE: 'Le prix proposé n’est pas valide.',
  INVALID_BOOST: 'Le supplément prioritaire n’est pas valide.',
  INVALID_IMAGE: 'L’image de référence n’a pas pu être prise en compte.',
  DETAILS_TOO_LONG: 'La description est trop longue (4000 caractères maximum).',
  INVALID_CONTACT: 'Le contact Instagram ou téléphone est trop long.',
}

export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : String(err)
  for (const key of Object.keys(ERROR_MESSAGES)) if (msg.includes(key)) return ERROR_MESSAGES[key]
  if (/failed to fetch|network/i.test(msg)) return 'Connexion impossible. Vérifie ta connexion internet et réessaie.'
  return msg || 'Une erreur est survenue.'
}
