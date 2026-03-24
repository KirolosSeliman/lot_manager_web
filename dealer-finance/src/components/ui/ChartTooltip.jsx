import { fmt } from '../../lib/utils'

export default function ChartTooltip({ active, payload, label, currency = true }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg border border-line3 rounded-lg px-3 py-2.5 shadow-2xl text-xs">
      <p className="text-dim text-[10px] tracking-widest uppercase mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-snow2 my-0.5">
          {p.name}:{' '}
          <span className="text-snow font-semibold font-mono">
            {currency && typeof p.value === 'number' ? fmt(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}
