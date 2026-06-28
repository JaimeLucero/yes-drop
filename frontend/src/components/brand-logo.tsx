import Link from 'next/link'
import { cn } from '@/lib/utils'

type BrandLogoProps = {
  /** Render the wordmark next to the badge */
  withText?: boolean
  /** Wrap in a Link to the given href */
  href?: string
  /** Badge size */
  size?: 'sm' | 'md' | 'lg'
  /** Override badge surface (e.g. on a colored panel) */
  badgeClassName?: string
  /** Override wordmark color */
  textClassName?: string
  className?: string
}

const SIZES = {
  sm: { badge: 'h-7 w-7 rounded-[0.45rem]', text: 'text-base' },
  md: { badge: 'h-8 w-8 rounded-[0.55rem]', text: 'text-xl' },
  lg: { badge: 'h-10 w-10 rounded-xl', text: 'text-2xl' },
} as const

/** Brand glyph: envelope whose flap is a checkmark, white on the brand gradient. */
function BrandBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden', className)}
      style={{ background: 'linear-gradient(135deg, #6FE4FB 0%, #40C6FF 30%, #5598F9 60%, #6455BF 100%)' }}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-[64%] w-[64%]"
        fill="none"
        stroke="#fff"
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="14" y="29" width="72" height="46" rx="13" />
        <path d="M28 41 L46 59 L74 31" />
      </svg>
    </span>
  )
}

export function BrandLogo({
  withText = true,
  href,
  size = 'md',
  badgeClassName,
  textClassName,
  className,
}: BrandLogoProps) {
  const s = SIZES[size]
  const inner = (
    <div className={cn('flex items-center gap-2', className)}>
      <BrandBadge className={cn(s.badge, badgeClassName)} />
      {withText && (
        <span className={cn('font-heading font-bold tracking-tight', s.text, textClassName)}>
          YesDrop
        </span>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex hover:opacity-80 transition-opacity">
        {inner}
      </Link>
    )
  }
  return inner
}
