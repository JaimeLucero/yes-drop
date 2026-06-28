import Link from 'next/link'
import { BrandLogo } from './brand-logo'

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Features', href: '/#features' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Create account', href: '/login?mode=signup' },
      { label: 'Sign in', href: '/login' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <BrandLogo href="/" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Approvals that don&apos;t need chasing. Send a request by email, get a one-click decision.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:contents">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="mb-3 text-sm font-heading font-semibold text-foreground">{col.title}</h3>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">© 2026 YesDrop. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
