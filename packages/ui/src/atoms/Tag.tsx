import type { CSSProperties } from 'react'
import { cx } from '../lib/cx'

type TagStyle = CSSProperties & Record<'--tag-tint', string>

interface TagProps {
  label: string
  /** Base hex for a tinted tag (bg = 15% color-mix). Omitted → neutral bordered variant. */
  tint?: string | undefined
  className?: string | undefined
}

export function Tag({ label, tint, className }: TagProps) {
  if (tint === undefined) {
    return <span className={cx('ui-tag', className)}>{label}</span>
  }
  const style: TagStyle = { '--tag-tint': tint }
  return (
    <span className={cx('ui-tag', className)} data-tint="" style={style}>
      {label}
    </span>
  )
}
