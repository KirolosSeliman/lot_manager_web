export default function ChartCard({ title, sub, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="mb-4">
        <div className="text-[11px] font-semibold text-snow2 tracking-widest uppercase">{title}</div>
        {sub && <div className="text-[10px] text-dim mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  )
}
