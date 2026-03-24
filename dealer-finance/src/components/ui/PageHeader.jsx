export default function PageHeader({ title, sub, actions }) {
  return (
    <header className="h-14 bg-surface border-b border-line flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div>
        <h1 className="font-display font-bold text-snow text-sm tracking-wider">{title}</h1>
        {sub && <p className="text-dim text-xs mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </header>
  )
}
