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
  sm: { badge: 'h-7 w-7 text-base rounded-md', text: 'text-base' },
  md: { badge: 'h-8 w-8 text-lg rounded-lg', text: 'text-xl' },
  lg: { badge: 'h-10 w-10 text-xl rounded-lg', text: 'text-2xl' },
} as const

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
      <div
        className={cn(
          'flex items-center justify-center bg-primary text-primary-foreground font-heading font-bold',
          s.badge,
          badgeClassName
        )}
      >
        Y
      </div>
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
