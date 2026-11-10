import { Suspense, lazy, useEffect } from 'react'
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import PublicLayout from './components/PublicLayout'
import Home from './pages/Home'
import Gallery from './pages/Gallery'
import RequestForm from './pages/RequestForm'
import Track from './pages/Track'
import { Spinner } from './components/ui'

// L'atelier est chargé à part : les clients ne téléchargent pas le code de l'admin.
const AdminLayout = lazy(() => import('./components/AdminLayout'))
const Login = lazy(() => import('./pages/admin/Login'))
const Requests = lazy(() => import('./pages/admin/Requests'))
const RequestDetail = lazy(() => import('./pages/admin/RequestDetail'))
const Expenses = lazy(() => import('./pages/admin/Expenses'))
const Creations = lazy(() => import('./pages/admin/Creations'))
const Stats = lazy(() => import('./pages/admin/Stats'))
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-semibold">Cette page a filé…</h1>
      <p className="text-ink-soft mt-2">Comme une maille échappée.</p>
      <Link to="/" className="btn btn-primary mt-6">
        Retour à l’accueil
      </Link>
    </div>
  )
}

// HashRouter : les adresses sont de la forme /#/galerie, ce qui fonctionne
// sur GitHub Pages sans aucune configuration serveur.
export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Suspense fallback={<Spinner />}>
        <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="galerie" element={<Gallery />} />
          <Route path="demande" element={<RequestForm />} />
          <Route path="suivi" element={<Track />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="admin/connexion" element={<Login />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Requests />} />
          <Route path="demandes/:id" element={<RequestDetail />} />
          <Route path="depenses" element={<Expenses />} />
          <Route path="realisations" element={<Creations />} />
          <Route path="rentabilite" element={<Stats />} />
          <Route path="reglages" element={<SettingsPage />} />
        </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
