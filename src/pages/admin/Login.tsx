import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { ErrorNote, Field, Logo } from '../../components/ui'

export default function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/admin" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(await signIn(email, password))
    setBusy(false)
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <form onSubmit={onSubmit} className="card stitch w-full max-w-sm space-y-5 p-7">
        <div className="text-center">
          <div className="mx-auto w-fit">
            <Logo size={52} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Espace Nina</h1>
          <p className="text-ink-soft text-sm">L’atelier est réservé à la créatrice.</p>
        </div>
        <Field label="Email">
          <input className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Mot de passe">
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorNote error={error} />
        <button type="submit" className="btn btn-primary relative z-10 w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
          Se connecter
        </button>
        <p className="relative z-10 text-center text-sm">
          <Link to="/" className="text-ink-soft hover:text-rose font-semibold">
            ← Retour au site
          </Link>
        </p>
      </form>
    </div>
  )
}
