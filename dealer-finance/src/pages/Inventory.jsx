import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, daysOnLot, STATUS } from '../lib/utils'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'

const STATUSES = [
  { value: '',       label: 'Tous' },
  { value: 'lot',    label: 'Sur le lot' },
  { value: 'repair', label: 'En réparation' },
  { value: 'bought', label: 'Acheté' },
  { value: 'sold',   label: 'Vendu' },
]

const SORTS = [
  { value: 'created_at_desc', label: 'Date d\'achat ↓' },
  { value: 'created_at_asc',  label: 'Date d\'achat ↑' },
  { value: 'profit_desc',     label: 'Profit ↓' },
  { value: 'lot_desc',        label: 'Temps sur lot ↓' },
  { value: 'cost_desc',       label: 'Coût de revient ↓' },
]

export default function Inventory() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('')
  const [sortBy,   setSortBy]   = useState('created_at_desc')
  const [lotAlert, setLotAlert] = useState(60)

  useEffect(() => { loadVehicles() }, [])

  async function loadVehicles() {
    setLoading(true)
    const [vRes, sRes] = await Promise.all([
      supabase.from('vehicle_summary').select('*'),
      supabase.from('settings').select('value').eq('key', 'lot_time_alert_days').single(),
    ])
    setVehicles(vRes.data || [])
    if (sRes.data) setLotAlert(Number(sRes.data.value))
    setLoading(false)
  }

  // Filter + sort
  const filtered = vehicles
    .filter(v => {
      if (status && v.status !== status) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          v.make?.toLowerCase().includes(q) ||
          v.model?.toLowerCase().includes(q) ||
          v.vin?.toLowerCase().includes(q) ||
          String(v.year).includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'created_at_asc':  return new Date(a.purchase_date) - new Date(b.purchase_date)
        case 'created_at_desc': return new Date(b.purchase_date) - new Date(a.purchase_date)
        case 'profit_desc':     return (b.net_profit || 0)  - (a.net_profit || 0)
        case 'lot_desc':        return (b.days_on_lot || 0) - (a.days_on_lot || 0)
        case 'cost_desc':       return (b.total_cost || 0)  - (a.total_cost || 0)
        default: return 0
      }
    })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Inventaire"
        sub={`${filtered.length} véhicule${filtered.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={() => navigate('/vehicles/new')}
            className="bg-snow text-bg font-display font-bold text-xs tracking-widest px-4 py-2 rounded-lg cursor-pointer border-none hover:opacity-90 transition-opacity">
            + Ajouter
          </button>
        }
      />

      {/* Filters */}
      <div className="flex-shrink-0 bg-surface border-b border-line px-4 md:px-6 py-3 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher marque, modèle, VIN…"
          className="field-input flex-1 min-w-[180px] max-w-xs text-xs py-2"
        />

        {/* Status tabs */}
        <div className="flex gap-1 bg-surface2 rounded-lg p-1 border border-line2">
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setStatus(s.value)}
              className="px-3 py-1 rounded-md text-xs cursor-pointer border-none transition-all"
              style={{
                background: status === s.value ? '#1E1E28' : 'transparent',
                color: status === s.value ? '#F4F3F8' : '#55546A',
                fontWeight: status === s.value ? 600 : 400,
              }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="field-input w-auto text-xs py-2">
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="text-5xl opacity-10">🚗</div>
            <p className="text-dim text-sm">Aucun véhicule trouvé</p>
            <button onClick={() => navigate('/vehicles/new')}
              className="text-snow2 text-xs underline cursor-pointer bg-transparent border-none">Ajouter le premier</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(v => <VehicleCard key={v.id} vehicle={v} lotAlert={lotAlert} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function VehicleCard({ vehicle: v, lotAlert }) {
  const navigate = useNavigate()
  const days = v.days_on_lot ?? daysOnLot(v.purchase_date, v.sale_date)
  const overdue = v.status !== 'sold' && days > lotAlert

  return (
    <div onClick={() => navigate(`/vehicles/${v.id}`)}
      className="bg-surface border border-line rounded-xl p-4 cursor-pointer hover:border-line3 transition-all hover:bg-surface2 group">

      {/* Photo placeholder / actual photo */}
      <div className="w-full aspect-video rounded-lg bg-surface2 border border-line2 mb-3 flex items-center justify-center overflow-hidden relative">
        {v.photo_url ? (
          <img src={v.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl opacity-10">🚗</span>
        )}
        {overdue && (
          <div className="absolute top-2 right-2 bg-stop/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
            ⚠ {days}j
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-snow text-sm leading-tight truncate">
            {v.year} {v.make} {v.model}
          </h3>
          <p className="text-dim text-[10px] mt-0.5 font-mono">{v.vin || '—'}</p>
        </div>
        <StatusBadge status={v.status} />
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-line">
        <div>
          <div className="text-[10px] text-dim mb-0.5">Coût de revient</div>
          <div className="font-mono text-xs text-snow">{fmt(v.total_cost)}</div>
        </div>
        {v.status === 'sold' ? (
          <div className="text-right">
            <div className="text-[10px] text-dim mb-0.5">Profit net</div>
            <div className={`font-mono text-xs font-bold ${(v.net_profit || 0) >= 0 ? 'text-go' : 'text-stop'}`}>
              {fmt(v.net_profit)}
            </div>
          </div>
        ) : (
          <div className="text-right">
            <div className="text-[10px] text-dim mb-0.5">Jours sur le lot</div>
            <div className={`font-mono text-xs ${overdue ? 'text-stop' : 'text-snow2'}`}>{days ?? '—'} j</div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-2">
        <span className="text-dim text-[10px]">{v.mileage ? `${v.mileage.toLocaleString('fr-CA')} km` : '—'}</span>
        <span className="text-dim text-[10px]">{fmtDate(v.purchase_date)}</span>
      </div>
    </div>
  )
}
