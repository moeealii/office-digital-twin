import type { ReactNode } from 'react'
import { cx } from '../lib/cx'

interface ButtonProps {
  onClick: () => void
  disabled?: boolean | undefined
  children: ReactNode
  className?: string | undefined
}

/** The primary action button — single rust-fill style, no variants. */
export function Button({ onClick, disabled, children, className }: ButtonProps) {
  return (
    <button type="button" className={cx('ui-button', className)} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
