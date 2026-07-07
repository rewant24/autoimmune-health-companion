'use client'

/**
 * PillButton — shared pill-shaped action button (W2-4, Lane 1D part 2).
 *
 * Replaces the byte-for-byte duplicated Save / "Not now" button rows that
 * lived 4× across MedicationConfirmCard + EventConfirmCard (now merged
 * into ConfirmCard), plus the near-identical rows in other check-in
 * surfaces. Token palette, min-h-11 tap target (joint-pain cohort —
 * never shrink this).
 *
 * `className` is appended after the variant classes so a call site can
 * widen padding or add layout utilities without forking the primitive.
 */

const base =
  'inline-flex min-h-11 items-center justify-center rounded-full px-5 ' +
  'text-[15px] font-medium transition-colors focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60'

const variants = {
  primary: 'bg-sage-deep text-bg-elevated',
  secondary: 'border border-rule bg-transparent text-ink',
} as const

export interface PillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
}

export function PillButton({
  variant = 'primary',
  className,
  type = 'button',
  ...rest
}: PillButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]}${className ? ` ${className}` : ''}`}
      {...rest}
    />
  )
}
