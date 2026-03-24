import { STATUS } from '../../lib/utils'

export default function StatusBadge({ status }) {
  const s = STATUS[status]
  if (!s) return null
  return (
    <span className={s.cls}>
      {s.label}
    </span>
  )
}
