import type { ReactNode } from 'react'
import { cx } from '../lib/cx'

interface TextButtonProps {
  onClick: () => void
  children: ReactNode
  className?: string | undefined
}

/** Underlined ghost button (12px) — "clear history", "show more". */
export function TextButton({ onClick, children, className }: TextButtonProps) {
  return (
    <button type="button" className={cx('ui-text-btn', className)} onClick={onClick}>
      {children}
    </button>
  )
}
