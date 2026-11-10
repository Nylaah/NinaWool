import { useEffect, useState, type ReactNode } from 'react'
import { Check, Copy, Loader2, X, Zap } from 'lucide-react'
import { STATUS, type RequestStatus } from '../lib/types'
import { euro } from '../lib/format'

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="#D4607A" />
      <g fill="none" stroke="#FBE3E8" strokeWidth="3" strokeLinecap="round">
        <path d="M10 26c12-10 32-10 44 0" />
        <path d="M7 36c16-12 36-10 50 2" />
        <path d="M12 47c12-9 28-9 40 0" />
        <path d="M24 8c-8 14-8 34 2 49" />
        <path d="M40 7c8 14 8 34-2 50" />
      </g>
      <path d="M50 50c6 4 9 2 10 7" fill="none" stroke="#B8405E" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function StatusChip({ status }: { status: RequestStatus }) {
  return <span className={`chip ${STATUS[status].chip}`}>{STATUS[status].label}</span>
}

export function BoostChip({ boost }: { boost: number }) {
  if (!(Number(boost) > 0)) return null
  return (
    <span className="chip bg-honey-soft text-honey" title="Supplément prioritaire">
      <Zap size={12} strokeWidth={3} aria-hidden="true" />+{euro(boost)}
    </span>
  )
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="text-ink-soft flex items-center justify-center gap-2 py-12" role="status">
      <Loader2 className="animate-spin" size={20} aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <p role="alert" className="bg-rose-soft text-rose-deep rounded-2xl px-4 py-3 text-sm font-semibold">
      {msg}
    </p>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-line text-ink-soft rounded-3xl border-2 border-dashed px-6 py-10 text-center">
      <p className="font-display text-ink text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div
      className="bg-ink/40 fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-paper max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-5 shadow-xl sm:rounded-3xl sm:p-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function CopyButton({ text, label, className = 'btn btn-outline btn-sm' }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      {copied ? 'Copié !' : label}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
  optional,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
  optional?: boolean
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {optional && <span className="text-ink-soft font-semibold"> · facultatif</span>}
      </span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  )
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
