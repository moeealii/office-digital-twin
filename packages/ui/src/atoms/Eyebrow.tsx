import type { ReactNode } from 'react'
import { cx } from '../lib/cx'

interface EyebrowProps {
  children: ReactNode
  className?: string | undefined
}

/** Lowercase letter-spaced kicker line above titles. */
export function Eyebrow({ children, className }: EyebrowProps) {
  return <p className={cx('ui-eyebrow', className)}>{children}</p>
}
