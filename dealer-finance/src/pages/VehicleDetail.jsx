import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useVehicle } from '../hooks/useVehicles'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmt, fmtDate, daysOnLot, STATUS, CHANNEL } from '../lib/utils'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'

export default function VehicleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { vehicle: v, costs, media, loading, reload } = useVehicle(id)
  const [deleting, setDeleting] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  const photos = media.filter(m => m.type === 'photo')
  const docs   = media.filter(m => m.type === 'document')
  const days   = v ? daysOnLot(v.purchase_date, v.sale_date) : null

  const handleDelete = async () => {
    if (!window.confirm('Supprimer ce véhicule définitivement ?')) return
    setDeleting(true)
    await supabase.from('vehicles').delete().eq('id', id)
    navigate('/inventory')
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>
  )
  if (!v) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-dim text-sm">Véhicule introuvable.</p>
    </div>
  )

  const totalCost = costs.reduce((s, c) => s + Number(c.amount || 0), 0)
  const netProfit = v.sale_price != null ? v.sale_price - totalCost : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title={`${v.year} ${v.make} ${v.model}`}
        sub={v.vin || 'VIN non renseigné'}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/vehicles/${id}/edit`)}
              className="btn-ghost px-4 py-2 text-xs">✏ Modifier</button>
            {isAdmin && (
              <button onClick={handleDelete} disabled={deleting}
                className="btn-ghost px-4 py-2 text-xs text-stop border-stop/30 hover:border-stop">
                {deleting ? '…' : '🗑 Supprimer'}
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 page-fade">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* LEFT COLUMN */}
          <div className="md:col-span-2 flex flex-col gap-5">

            {/* Photos */}
            {photos.length > 0 ? (
              <div className="card p-0 overflow-hidden">
                <img
                  src={photos[0] ? supabase.storage.from('vehicle-photos').getPublicUrl(photos[0].storage_path).data.publicUrl : ''}
                  alt="" className="w-full aspect-video object-cover cursor-pointer"
                  onClick={() => setLightbox(0)}
                />
                {photos.length > 1 && (
                  <div className="grid grid-cols-4 gap-1 p-2">
                    {photos.slice(1, 5).map((p, i) => {
                      const url = supabase.storage.from('vehicle-photos').getPublicUrl(p.storage_path).data.publicUrl
                      return (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden cursor-pointer relative"
                          onClick={() => setLightbox(i + 1)}>
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          {i === 3 && photos.length > 5 && (
                            <div className="absolute inset-0 bg-bg/70 flex items-center justify-center text-snow font-bold text-sm">
                              +{photos.length - 5}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="card flex items-center justify-center aspect-video text-dim">
                <div className="text-center">
                  <div className="text-5xl mb-2 opacity-20">🚗</div>
                  <p className="text-xs">Aucune photo</p>
                </div>
              </div>
            )}

            {/* Infos véhicule */}
            <div className="card">
              <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-4">Informations</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Année',             v.year],
                  ['Marque',            v.make],
                  ['Modèle',            v.model],
                  ['Couleur',           v.color],
                  ['Transmission',      v.transmission],
                  ['Kilométrage',       v.mileage ? `${v.mileage.toLocaleString('fr-CA')} km` : '—'],
                  ['Province d\'origine', v.origin_province],
                  ['Source',            v.purchase_source],
                  ['Date d\'achat',     fmtDate(v.purchase_date)],
                  ['Jours sur le lot',  days != null ? `${days} jours` : '—'],
                ].map(([k, val]) => (
                  <div key={k}>
                    <div className="text-[10px] text-dim">{k}</div>
                    <div className="text-snow2 text-xs mt-0.5 font-medium">{val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Costs breakdown */}
            <div className="card">
              <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-4">Détail des coûts</div>
              <div className="flex flex-col">
                {costs.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-line last:border-none">
                    <div className="flex items-center gap-2">
                      <span className="text-snow2 text-xs">{c.label || c.cost_type}</span>
                      {c.cost_type === 'tax' && c.is_tax_recoverable && (
                        <span className="text-[9px] text-go border border-go/30 rounded px-1">récupérable</span>
                      )}
                      {['tax','openlane','commission'].includes(c.cost_type) && (
                        <span className="text-[9px] text-dim border border-line2 rounded px-1">auto</span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-snow">{fmt(c.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-line3 bg-white/[0.03] rounded-lg px-3 py-2">
                  <span className="text-xs font-bold text-snow">Coût de revient total</span>
                  <span className="font-mono text-sm font-bold text-snow">{fmt(totalCost)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {v.notes && (
              <div className="card">
                <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-3">Notes internes</div>
                <p className="text-snow2 text-sm leading-relaxed">{v.notes}</p>
              </div>
            )}

            {/* Documents */}
            {docs.length > 0 && (
              <div className="card">
                <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-3">Documents</div>
                <div className="flex flex-col gap-2">
                  {docs.map((d, i) => {
                    const url = supabase.storage.from('vehicle-documents').getPublicUrl(d.storage_path).data.publicUrl
                    return (
                      <a key={i} href={url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-3 p-3 bg-surface2 border border-line2 rounded-lg hover:border-line3 transition-colors">
                        <span className="text-lg">📄</span>
                        <span className="text-snow2 text-xs flex-1">{d.label || 'Document'}</span>
                        <span className="text-dim text-[10px]">Ouvrir ↗</span>
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-5">

            {/* Status card */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] text-dim tracking-widest uppercase font-semibold">Statut</span>
                <StatusBadge status={v.status} />
              </div>
              <div className="flex flex-col gap-3">
                <Stat label="Coût de revient" value={fmt(totalCost)} mono />
                {netProfit != null && (
                  <Stat label="Profit net" value={fmt(netProfit)}
                    mono highlight={netProfit >= 0 ? 'green' : 'red'} />
                )}
                <Stat label="Jours sur le lot" value={days != null ? `${days} j` : '—'} />
              </div>
            </div>

            {/* Sale info */}
            {v.status === 'sold' && v.sale_price && (
              <div className="card">
                <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-4">Vente</div>
                <div className="flex flex-col gap-3">
                  <Stat label="Prix de vente" value={fmt(v.sale_price)} mono />
                  <Stat label="Date de vente" value={fmtDate(v.sale_date)} />
                  <Stat label="Canal" value={CHANNEL[v.sale_channel] || v.sale_channel || '—'} />
                  {v.sale_notes && (
                    <div>
                      <div className="text-[10px] text-dim mb-1">Notes</div>
                      <p className="text-snow2 text-xs">{v.sale_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="card">
              <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-3">Actions</div>
              <div className="flex flex-col gap-2">
                <button onClick={() => navigate(`/vehicles/${id}/edit`)}
                  className="btn-primary text-xs py-2.5">✏ Modifier la fiche</button>
                {v.status !== 'sold' && (
                  <button onClick={() => navigate(`/vehicles/${id}/edit`)}
                    className="btn-ghost py-2 text-xs text-go border-go/30">
                    💵 Marquer comme vendu
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Lightbox */}
      {lightbox != null && (
        <div className="fixed inset-0 bg-bg/95 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img
            src={supabase.storage.from('vehicle-photos').getPublicUrl(photos[lightbox]?.storage_path).data.publicUrl}
            alt="" className="max-w-full max-h-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button className="absolute top-4 right-4 text-snow text-2xl bg-transparent border-none cursor-pointer">✕</button>
          {lightbox > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 text-snow text-2xl bg-bg/50 rounded-full w-10 h-10 border-none cursor-pointer"
              onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1) }}>‹</button>
          )}
          {lightbox < photos.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-snow text-2xl bg-bg/50 rounded-full w-10 h-10 border-none cursor-pointer"
              onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1) }}>›</button>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, mono, highlight }) {
  const color = highlight === 'green' ? '#2DD4A0' : highlight === 'red' ? '#E05A5A' : '#F4F3F8'
  return (
    <div>
      <div className="text-[10px] text-dim mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${mono ? 'font-mono' : ''}`} style={{ color }}>{value}</div>
    </div>
  )
}
