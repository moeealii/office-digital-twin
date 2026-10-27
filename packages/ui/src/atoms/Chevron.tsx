import { cx } from '../lib/cx'

interface ChevronProps {
  open: boolean
  className?: string | undefined
}

/**
 * Inline-SVG disclosure chevron (currentColor). Points down when open;
 * CSS rotates it -90° via [data-open="false"], transition var(--dur-base).
 */
export function Chevron({ open, className }: ChevronProps) {
  return (
    <span className={cx('ui-chevron', className)} data-open={open} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 4.25 6 7.75l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
