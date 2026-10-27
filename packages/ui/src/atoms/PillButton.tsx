import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import { Chevron } from './Chevron'

interface PillButtonProps {
  onClick: () => void
  disabled?: boolean | undefined
  /** When given, the button controls a disclosure: renders a trailing Chevron and sets aria-expanded. */
  open?: boolean | undefined
  children: ReactNode
  className?: string | undefined
}

export function PillButton({ onClick, disabled, open, children, className }: PillButtonProps) {
  return (
    <button type="button" className={cx('ui-pill-btn', className)} onClick={onClick} disabled={disabled} aria-expanded={open}>
      {children}
      {open !== undefined && <Chevron open={open} />}
    </button>
  )
}
