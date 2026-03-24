export default function KpiCard({ label, value, sub, delta, accent, loading }) {
  return (
    <div className={`card relative overflow-hidden ${accent ? 'border-line3' : ''}`}
      style={{ background: accent ? 'rgba(255,255,255,0.03)' : undefined }}>
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}
      <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-3">{label}</div>
      {loading ? (
        <div className="h-7 w-24 bg-surface2 rounded animate-pulse mb-2" />
      ) : (
        <div className="font-display font-extrabold text-snow text-2xl tracking-tight leading-none mb-2">{value}</div>
      )}
      <div className="flex items-center gap-2">
        {delta != null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${delta >= 0 ? 'bg-go/10 text-go' : 'bg-stop/10 text-stop'}`}>
            {delta >= 0 ? `↑ +${delta}%` : `↓ ${delta}%`}
          </span>
        )}
        {sub && <span className="text-dim text-[11px]">{sub}</span>}
      </div>
    </div>
  )
}
