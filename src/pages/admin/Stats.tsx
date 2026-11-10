import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useExpenses, useRequests, useSessions, useSettings } from '../../lib/api'
import { duration, euro, revenueOf, sessionMs, totalMs } from '../../lib/format'
import { Empty, PageTitle, Spinner, StatusChip } from '../../components/ui'

const round2 = (n: number) => Math.round(n * 100) / 100

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card p-4">
      <p className="text-ink-soft text-sm font-bold">{label}</p>
      <p className={`font-display tabular text-2xl font-semibold ${tone === 'good' ? 'text-sage' : tone === 'bad' ? 'text-rose-deep' : ''}`}>
        {value}
      </p>
      {sub && <p className="text-ink-soft text-xs font-semibold">{sub}</p>}
    </div>
  )
}

export default function Stats() {
  const { data: requests, isLoading } = useRequests()
  const { data: sessions } = useSessions()
  const { data: expenses } = useExpenses()
  const { data: settings } = useSettings()
  const years = useMemo(() => {
    const set = new Set<string>([String(new Date().getFullYear())])
    for (const r of requests ?? []) set.add(r.updated_at.slice(0, 4))
    for (const e of expenses ?? []) set.add(e.spent_on.slice(0, 4))
    return [...set].sort().reverse()
  }, [requests, expenses])
  const [year, setYear] = useState<string>('tout')

  if (isLoading || !requests || !sessions || !expenses) return <Spinner />

  const inYear = (iso: string) => year === 'tout' || iso.startsWith(year)
  const goal = Number(settings?.hourly_goal ?? 0)

  // Encaissé = commandes payées (datées de leur dernier changement). À venir = acceptées → livrées.
  const paid = requests.filter((r) => r.status === 'payee' && inYear(r.updated_at))
  const pending = requests.filter((r) => ['acceptee', 'en_cours', 'terminee', 'livree'].includes(r.status))
  const yearExpenses = expenses.filter((e) => inYear(e.spent_on))
  const yearSessions = sessions.filter((s) => inYear(s.started_at))

  const revenue = paid.reduce((s, r) => s + revenueOf(r), 0)
  const spent = yearExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const profit = revenue - spent
  const hours = totalMs(yearSessions) / 3_600_000
  const hourly = hours > 0.01 ? profit / hours : null
  const boostTotal = paid.reduce((s, r) => s + Number(r.boost), 0)

  // Par mois
  const monthMap = new Map<string, { revenue: number; spent: number; ms: number }>()
  const bucket = (key: string) => {
    if (!monthMap.has(key)) monthMap.set(key, { revenue: 0, spent: 0, ms: 0 })
    return monthMap.get(key)!
  }
  for (const r of paid) bucket(r.updated_at.slice(0, 7)).revenue += revenueOf(r)
  for (const e of yearExpenses) bucket(e.spent_on.slice(0, 7)).spent += Number(e.amount)
  for (const s of yearSessions) bucket(s.started_at.slice(0, 7)).ms += sessionMs(s)
  const months = [...monthMap.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  // Par projet (ceux qui ont du temps ou sont terminés)
  const projects = requests
    .map((r) => {
      const ms = totalMs(sessions.filter((s) => s.request_id === r.id))
      const cost = expenses.filter((e) => e.request_id === r.id).reduce((s, e) => s + Number(e.amount), 0)
      const net = revenueOf(r) - cost
      return { r, ms, cost, net, rate: ms > 36_000 ? net / (ms / 3_600_000) : null }
    })
    .filter((p) => p.ms > 0 && !['refusee', 'annulee'].includes(p.r.status))
    .filter((p) => inYear(p.r.updated_at))

  return (
    <div>
      <PageTitle title="Rentabilité">
        <select className="input !w-auto !py-2 font-bold" aria-label="Période" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="tout">Depuis le début</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Encaissé" value={euro(round2(revenue))} sub={`${paid.length} commande${paid.length > 1 ? 's' : ''} payée${paid.length > 1 ? 's' : ''}${boostTotal > 0 ? ` · dont ${euro(boostTotal)} de boost` : ''}`} />
        <Kpi label="Dépenses" value={euro(round2(spent))} sub={`${yearExpenses.length} achat${yearExpenses.length > 1 ? 's' : ''}`} />
        <Kpi label="Bénéfice" value={euro(round2(profit))} tone={profit >= 0 ? 'good' : 'bad'} />
        <Kpi
          label="Taux horaire réel"
          value={hourly == null ? '—' : `${euro(round2(hourly))} / h`}
          sub={`${duration(hours * 3_600_000)} de travail${goal ? ` · objectif ${euro(goal)} / h` : ''}`}
          tone={hourly == null || !goal ? undefined : hourly >= goal ? 'good' : 'bad'}
        />
      </div>

      {pending.length > 0 && (
        <p className="bg-plum-soft text-ink mt-4 rounded-2xl px-4 py-3 text-sm font-semibold">
          À venir : {euro(round2(pending.reduce((s, r) => s + revenueOf(r), 0)))} sur {pending.length} commande
          {pending.length > 1 ? 's' : ''} acceptée{pending.length > 1 ? 's' : ''} mais pas encore payée{pending.length > 1 ? 's' : ''}.
        </p>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold">Mois par mois</h2>
      {months.length === 0 ? (
        <Empty title="Pas encore de données sur cette période" />
      ) : (
        <div className="card overflow-x-auto !rounded-2xl">
          <table className="tabular w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="text-ink-soft text-left">
                <th className="px-4 py-2.5 font-bold">Mois</th>
                <th className="px-4 py-2.5 text-right font-bold">Encaissé</th>
                <th className="px-4 py-2.5 text-right font-bold">Dépenses</th>
                <th className="px-4 py-2.5 text-right font-bold">Bénéfice</th>
                <th className="px-4 py-2.5 text-right font-bold">Temps</th>
              </tr>
            </thead>
            <tbody>
              {months.map(([m, v]) => (
                <tr key={m} className="border-line border-t">
                  <td className="px-4 py-2.5 font-bold capitalize">
                    {new Date(`${m}-15`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5 text-right">{euro(round2(v.revenue))}</td>
                  <td className="px-4 py-2.5 text-right">{euro(round2(v.spent))}</td>
                  <td className={`px-4 py-2.5 text-right font-extrabold ${v.revenue - v.spent >= 0 ? 'text-sage' : 'text-rose-deep'}`}>
                    {euro(round2(v.revenue - v.spent))}
                  </td>
                  <td className="px-4 py-2.5 text-right">{duration(v.ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 mb-1 text-lg font-semibold">Projet par projet</h2>
      <p className="text-ink-soft mb-3 text-sm">
        Taux horaire = (prix − dépenses liées au projet) ÷ temps chronométré.
      </p>
      {projects.length === 0 ? (
        <Empty title="Aucun projet chronométré">Lance le chrono sur un projet pour voir ce qu’il rapporte vraiment.</Empty>
      ) : (
        <div className="card overflow-x-auto !rounded-2xl">
          <table className="tabular w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-ink-soft text-left">
                <th className="px-4 py-2.5 font-bold">Projet</th>
                <th className="px-4 py-2.5 text-right font-bold">Prix</th>
                <th className="px-4 py-2.5 text-right font-bold">Dépenses</th>
                <th className="px-4 py-2.5 text-right font-bold">Temps</th>
                <th className="px-4 py-2.5 text-right font-bold">Taux horaire</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(({ r, ms, cost, rate }) => (
                <tr key={r.id} className="border-line border-t">
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/demandes/${r.id}`} className="hover:text-rose font-bold hover:underline">
                      {r.subject}
                    </Link>{' '}
                    <span className="text-ink-soft">· {r.size_cm} cm</span> <StatusChip status={r.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right">{euro(revenueOf(r))}</td>
                  <td className="px-4 py-2.5 text-right">{euro(round2(cost))}</td>
                  <td className="px-4 py-2.5 text-right">{duration(ms)}</td>
                  <td className={`px-4 py-2.5 text-right font-extrabold ${rate == null ? '' : goal && rate < goal ? 'text-rose-deep' : 'text-sage'}`}>
                    {rate == null ? '—' : `${euro(round2(rate))} / h`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
