import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, daysOnLot, STATUS, monthlyAmount } from '../lib/utils'
import PageHeader from '../components/ui/PageHeader'
import KpiCard from '../components/ui/KpiCard'
import ChartCard from '../components/ui/ChartCard'
import ChartTooltip from '../components/ui/ChartTooltip'
import StatusBadge from '../components/ui/StatusBadge'

const C = {
  white: '#F4F3F8', white2: '#C8C7D4', muted: '#55546A',
  border: '#1F1F28', border2: '#2A2A38', border3: '#34344A',
  surface2: '#18181F', green: '#2DD4A0', red: '#E05A5A',
  orange: '#E09050', blue: '#6C8EF5',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading]   = useState(true)
  const [kpis,    setKpis]      = useState({})
  const [cashData,   setCash]   = useState([])
  const [profitData, setProfit] = useState([])
  const [marqueData, setMarque] = useState([])
  const [statutData, setStatut] = useState([])
  const [depData,    setDep]    = useState([])
  const [top5,       setTop5]   = useState([])
  const [overdue,    setOverdue]= useState([])
  const [lotAlert,   setLotAlert] = useState(60)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [summaries, expenses, settings] = await Promise.all([
      supabase.from('vehicle_summary').select('*'),
      supabase.from('fixed_expenses').select('*').eq('is_active', true),
      supabase.from('settings').select('*'),
    ])

    const vehicles = summaries.data || []
    const exps     = expenses.data  || []
    const sets     = Object.fromEntries((settings.data || []).map(s => [s.key, s.value]))

    const alertDays = Number(sets.lot_time_alert_days || 60)
    setLotAlert(alertDays)

    // KPIs
    const active   = vehicles.filter(v => v.status !== 'sold')
    const sold     = vehicles.filter(v => v.status === 'sold')
    const thisMonth = sold.filter(v => {
      if (!v.sale_date) return false
      const d = new Date(v.sale_date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    const totalInvested   = active.reduce((s, v) => s + (v.total_cost || 0), 0)
    const totalSalesCash  = sold.reduce((s, v)  => s + (v.sale_price || 0), 0)
    const monthlyExp      = exps.reduce((s, e)  => s + monthlyAmount(e), 0)
    const cashFree        = totalSalesCash - totalInvested - monthlyExp
    const avgProfit       = sold.length ? sold.reduce((s, v) => s + (v.net_profit || 0), 0) / sold.length : 0
    const soldLotTimes    = sold.filter(v => v.days_on_lot != null).map(v => v.days_on_lot)
    const avgLot          = soldLotTimes.length ? soldLotTimes.reduce((a, b) => a + b, 0) / soldLotTimes.length : 0
    const monthProfit     = thisMonth.reduce((s, v) => s + (v.net_profit || 0), 0)

    setKpis({
      cashFree, totalInvested,
      activeCount: active.length,
      monthCount: thisMonth.length, monthProfit,
      avgProfit, avgLot: Math.round(avgLot),
    })

    // Overdue vehicles
    const od = active.filter(v => {
      const days = daysOnLot(v.purchase_date)
      return days > alertDays
    })
    setOverdue(od)

    // --- CHARTS ---

    // 1. Cash libre 12 months (last 12 months simulated from sold data)
    buildCashChart(sold, exps, setCash)

    // 2. Profit per vehicle (last 15 sold)
    const last15 = sold.slice(0, 15).reverse()
    setProfit(last15.map(v => ({
      l: `${v.make?.slice(0,7)} ${v.year?.toString().slice(2)}`,
      p: v.net_profit || 0,
    })))

    // 3. Profit by make
    const byMake = {}
    sold.forEach(v => {
      if (!v.make) return
      if (!byMake[v.make]) byMake[v.make] = { total: 0, count: 0 }
      byMake[v.make].total += v.net_profit || 0
      byMake[v.make].count += 1
    })
    setMarque(
      Object.entries(byMake)
        .filter(([, d]) => d.count >= 1)
        .map(([m, d]) => ({ m, p: Math.round(d.total / d.count) }))
        .sort((a, b) => b.p - a.p)
        .slice(0, 7)
    )

    // 4. Status counts
    const sc = { bought: 0, repair: 0, lot: 0, sold: 0 }
    vehicles.forEach(v => { if (sc[v.status] != null) sc[v.status]++ })
    setStatut([
      { name: 'Sur le lot',      v: sc.lot,    color: C.green  },
      { name: 'En réparation',   v: sc.repair, color: C.orange },
      { name: 'Acheté',          v: sc.bought, color: C.blue   },
      { name: 'Vendu',           v: sc.sold,   color: C.muted  },
    ])

    // 5. Depenses vs profit last 6 months
    buildDepChart(sold, exps, setDep)

    // 6. Top 5
    const t5 = [...sold]
      .sort((a, b) => (b.net_profit || 0) - (a.net_profit || 0))
      .slice(0, 5)
    setTop5(t5)

    setLoading(false)
  }

  function buildCashChart(sold, exps, setter) {
    const months = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('fr-CA', { month: 'short' })
      const inMonth = sold.filter(v => {
        if (!v.sale_date) return false
        const sd = new Date(v.sale_date)
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear()
      })
      const revenue = inMonth.reduce((s, v) => s + (v.sale_price || 0), 0)
      const costs   = inMonth.reduce((s, v) => s + (v.total_cost || 0), 0)
      const monthExp = exps.reduce((s, e) => s + monthlyAmount(e), 0)
      months.push({ m: label, v: Math.max(0, revenue - costs - monthExp) })
    }
    setter(months)
  }

  function buildDepChart(sold, exps, setter) {
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('fr-CA', { month: 'short' })
      const inMonth = sold.filter(v => {
        if (!v.sale_date) return false
        const sd = new Date(v.sale_date)
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear()
      })
      const prof   = inMonth.reduce((s, v) => s + (v.net_profit || 0), 0)
      const dep    = exps.reduce((s, e) => s + monthlyAmount(e), 0)
      months.push({ m: label, prof, dep })
    }
    setter(months)
  }

  const total = statutData.reduce((s, d) => s + d.v, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Tableau de bord"
        sub={new Date().toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}
        actions={
          overdue.length > 0 && (
            <div className="flex items-center gap-1.5 bg-stop/10 border border-stop/20 rounded-lg px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-stop" />
              <span className="text-stop text-xs font-medium">{overdue.length} véhicule{overdue.length > 1 ? 's' : ''} &gt; {lotAlert}j</span>
            </div>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 page-fade">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <KpiCard label="Cash libre total"        value={fmt(kpis.cashFree || 0, true)}       accent loading={loading} />
          <KpiCard label="Capital investi (actif)"  value={fmt(kpis.totalInvested || 0, true)}  loading={loading} />
          <KpiCard label="Véhicules actifs"         value={kpis.activeCount ?? '—'}              sub="sur le lot + réparation + achetés" loading={loading} />
          <KpiCard label="Vendus ce mois"           value={kpis.monthCount ?? '—'}              sub={kpis.monthProfit != null ? fmt(kpis.monthProfit, true) : ''} loading={loading} />
          <KpiCard label="Profit net moyen / vente" value={fmt(kpis.avgProfit || 0, true)}       loading={loading} />
          <KpiCard label="Average Lot Time"         value={`${kpis.avgLot ?? '—'} j`}           sub="sur les ventes complétées" loading={loading} />
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <ChartCard title="Évolution du cash libre" sub="12 derniers mois">
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={cashData}>
                  <defs>
                    <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="rgba(255,255,255,0.12)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                  <XAxis dataKey="m" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="v" name="Cash libre" stroke={C.white} strokeWidth={1.5} fill="url(#gr)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Inventaire par statut">
            <div className="flex flex-col gap-3 mt-1">
              {statutData.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-0.5 h-7 rounded flex-shrink-0" style={{ background: s.color }} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-snow2 text-xs">{s.name}</span>
                      <span className="font-mono text-xs text-snow">{s.v}</span>
                    </div>
                    <div className="h-0.5 rounded overflow-hidden" style={{ background: C.surface2 }}>
                      <div className="h-full rounded opacity-70 transition-all duration-700"
                        style={{ width: total ? `${(s.v / total) * 100}%` : '0%', background: s.color }} />
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-line flex justify-between">
                <span className="text-dim text-xs">Total</span>
                <span className="font-mono text-xs text-snow">{total}</span>
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="md:col-span-3">
            <ChartCard title="Profit net par vente" sub="15 dernières transactions">
              <ResponsiveContainer width="100%" height={175}>
                <BarChart data={profitData} barSize={16} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                  <XAxis dataKey="l" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="p" name="Profit" radius={[3, 3, 0, 0]}>
                    {profitData.map((e, i) => (
                      <Cell key={i} fill={e.p < 0 ? C.red : e.p > 4000 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="md:col-span-2">
            <ChartCard title="Profit moyen par marque">
              <ResponsiveContainer width="100%" height={175}>
                <BarChart data={marqueData} layout="vertical" barSize={10}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.border} horizontal={false} />
                  <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="m" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="p" name="Profit" fill="rgba(255,255,255,0.55)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3">
            <ChartCard title="Dépenses fixes vs profit net" sub="6 derniers mois">
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={depData}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                  <XAxis dataKey="m" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="prof" name="Profit net" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} dot={{ r: 3, fill: C.white, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="dep"  name="Dépenses"  stroke={C.red} strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3, fill: C.red, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="md:col-span-2">
            <ChartCard title="Top 5 véhicules" sub="Profit net — tous temps">
              <div className="flex flex-col">
                {top5.length === 0 && !loading && (
                  <p className="text-dim text-xs text-center py-8">Aucune vente enregistrée.</p>
                )}
                {top5.map((r, i) => (
                  <button key={r.id} onClick={() => navigate(`/vehicles/${r.id}`)}
                    className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-none hover:bg-white/[0.02] transition-colors rounded cursor-pointer w-full text-left">
                    <span className="font-mono text-[10px] w-4 text-center flex-shrink-0" style={{ color: i === 0 ? C.white : C.muted }}>0{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-snow2 text-xs truncate">{r.year} {r.make} {r.model}</div>
                      <div className="text-dim text-[10px] mt-0.5">{r.days_on_lot}j sur le lot</div>
                    </div>
                    <span className="font-mono text-xs text-snow flex-shrink-0">{fmt(r.net_profit, true)}</span>
                  </button>
                ))}
              </div>
            </ChartCard>
          </div>
        </div>

      </div>
    </div>
  )
}
