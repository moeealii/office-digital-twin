import type { ReactNode } from 'react'
import { cx } from '../lib/cx'

interface StatTileProps {
  value: ReactNode
  label: ReactNode
  className?: string | undefined
}

/** Bordered paper-2 inset tile: display-face tabular value over a small-caps label. */
export function StatTile({ value, label, className }: StatTileProps) {
  return (
    <div className={cx('ui-stat', className)}>
      <div className="ui-stat-value">{value}</div>
      <div className="ui-stat-label">{label}</div>
    </div>
  )
}
