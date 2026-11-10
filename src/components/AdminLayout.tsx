import { Link, NavLink, Navigate, Outlet } from 'react-router-dom'
import { ChartNoAxesCombined, Images, Inbox, LogOut, ReceiptText, Settings2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Logo, Spinner } from './ui'
import { ConfigBanner } from './PublicLayout'
import TimerWidget from './TimerWidget'

const NAV = [
  { to: '/admin', end: true, label: 'Demandes', icon: Inbox },
  { to: '/admin/depenses', label: 'Dépenses', icon: ReceiptText },
  { to: '/admin/realisations', label: 'Galerie', icon: Images },
  { to: '/admin/rentabilite', label: 'Rentabilité', icon: ChartNoAxesCombined },
  { to: '/admin/reglages', label: 'Réglages', icon: Settings2 },
]

export default function AdminLayout() {
  const { session, isAdmin, loading, signOut } = useAuth()

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/admin/connexion" replace />
  if (isAdmin === null) return <Spinner label="Vérification du compte…" />
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Ce compte n’est pas administrateur</h1>
        <p className="text-ink-soft mt-2">
          Connecté en tant que <strong>{session.user.email}</strong>. Si c’est bien ton compte, il reste à l’ajouter à
          la table <code>admins</code> (dernière étape du README).
        </p>
        <button type="button" className="btn btn-outline mt-6" onClick={() => void signOut()}>
          Se déconnecter
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <ConfigBanner />
      <header className="border-line bg-cream/90 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/admin" className="flex items-center gap-2">
            <Logo size={30} />
            <span className="font-display text-lg font-semibold">
              Nina<span className="text-rose">Wool</span>
              <span className="text-ink-soft ml-2 text-sm font-medium">atelier</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Navigation atelier">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition ${isActive ? 'bg-rose-soft text-rose-deep' : 'text-ink-soft hover:text-rose'}`
                }
              >
                <n.icon size={16} aria-hidden="true" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Link to="/" className="btn btn-ghost btn-sm">
              Voir le site
            </Link>
            <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={() => void signOut()} aria-label="Se déconnecter" title="Se déconnecter">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-36">
        <Outlet />
      </main>

      <TimerWidget />

      {/* Barre d'onglets en bas sur mobile */}
      <nav
        aria-label="Navigation atelier"
        className="border-line bg-paper fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${isActive ? 'text-rose' : 'text-ink-soft'}`
            }
          >
            <n.icon size={21} aria-hidden="true" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
