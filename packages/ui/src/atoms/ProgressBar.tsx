import { cx } from '../lib/cx'

interface ProgressBarProps {
  value: number
  max: number
  label: string
  className?: string | undefined
}

/** Thin accent progress track. `value` is clamped to [0, max]; a non-positive `max` renders 0%. */
export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const clamped = max > 0 ? Math.min(Math.max(value, 0), max) : 0
  const pct = max > 0 ? (clamped / max) * 100 : 0
  return (
    <div
      className={cx('ui-progress', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-label={label}
    >
      <div className="ui-progress-fill" style={{ width: `${String(pct)}%` }} />
    </div>
  )
}
