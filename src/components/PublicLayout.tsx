import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Download } from 'lucide-react'
import { Logo } from './ui'
import { supabaseConfigured } from '../lib/supabase'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

/** Bouton « Installer l'app » (Android, Windows, Mac, Linux via Chrome/Edge). */
function InstallButton() {
  const [evt, setEvt] = useState<InstallPromptEvent | null>(null)
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvt(e as InstallPromptEvent)
    }
    const onInstalled = () => setEvt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
  if (!evt) return null
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        await evt.prompt()
        setEvt(null)
      }}
    >
      <Download size={16} aria-hidden="true" />
      Installer l’app
    </button>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-2 text-sm font-bold transition ${isActive ? 'bg-rose-soft text-rose-deep' : 'text-ink-soft hover:text-rose'}`

export function ConfigBanner() {
  if (supabaseConfigured) return null
  return (
    <div className="bg-honey-soft text-ink px-4 py-2 text-center text-sm font-semibold">
      Supabase n’est pas encore configuré : ajoute <code>VITE_SUPABASE_URL</code> et{' '}
      <code>VITE_SUPABASE_ANON_KEY</code> (voir le README).
    </div>
  )
}

export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ConfigBanner />
      <header className="border-line bg-cream/90 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2" aria-label="NinaWool — accueil">
            <Logo size={34} />
            <span className="font-display text-xl font-semibold tracking-tight">
              Nina<span className="text-rose">Wool</span>
            </span>
          </Link>
          <nav className="flex items-center gap-0.5" aria-label="Navigation principale">
            <NavLink to="/galerie" className={navClass}>
              Galerie
            </NavLink>
            <NavLink to="/suivi" className={navClass}>
              Suivi
            </NavLink>
            <Link to="/demande" className="btn btn-primary btn-sm ml-1.5">
              <span className="sm:hidden">Commander</span>
              <span className="hidden sm:inline">Faire une demande</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-line text-ink-soft border-t">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm">
          <p>NinaWool · peluches au crochet faites main · paiement à la livraison</p>
          <div className="flex items-center gap-1">
            <InstallButton />
            <Link to="/admin" className="btn btn-ghost btn-sm">
              Espace Nina
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
