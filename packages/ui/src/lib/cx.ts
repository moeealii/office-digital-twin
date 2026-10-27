// Internal className joiner: every component accepts `className?: string` (appended).
// Not part of the public barrel.
export function cx(base: string, className?: string): string {
  return className ? `${base} ${className}` : base
}
