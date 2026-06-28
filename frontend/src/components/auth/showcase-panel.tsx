import { Check, X, Paperclip } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { StatStrip } from '@/components/landing/stat-strip'

/**
 * Decorative right half of the auth pages. Product-forward: a floating YesDrop
 * request mockup (the one-click approve/reject moment) over a soft aurora glow
 * and a faint dot grid, with honest social proof (StatStrip) underneath.
 * All motion is CSS-only and disabled under prefers-reduced-motion.
 */
export function ShowcasePanel() {
  return (
    <div className="relative hidden flex-1 flex-col justify-center overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
      {/* Aurora glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-aurora-drift absolute -left-16 -top-24 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl" />
        <div
          className="animate-aurora-drift absolute right-[-3rem] top-1/3 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl"
          style={{ animationDelay: '-6s' }}
        />
        <div
          className="animate-aurora-drift absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl"
          style={{ animationDelay: '-12s' }}
        />
      </div>

      {/* Faint dot grid with radial fade */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full text-primary-foreground"
        style={{
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 78%)',
        }}
      >
        <defs>
          <pattern id="showcase-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1.3" cy="1.3" r="1.3" fill="currentColor" opacity="0.12" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#showcase-dots)" />
      </svg>

      {/* Foreground */}
      <div className="relative z-10 mx-auto w-full max-w-md space-y-8">
        <BrandLogo
          href="/"
          size="lg"
          badgeClassName="bg-primary-foreground/15 text-primary-foreground"
          textClassName="text-primary-foreground"
        />
        <div className="space-y-3">
          <h2 className="text-[1.75rem] font-heading font-semibold leading-snug tracking-tight">
            Approvals that close themselves.
          </h2>
          <p className="text-base leading-relaxed text-primary-foreground/75">
            Email approvals with deadlines and automatic reminders — every response tracked in one place.
          </p>
        </div>

        {/* Product mockup */}
        <div className="relative pb-8 pt-2">
          {/* Peeking row behind */}
          <div className="animate-float-slow absolute -bottom-2 right-2 w-64 rotate-[3deg] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <span className="flex-1 truncate text-xs font-medium text-slate-700">Contract review</span>
              <span className="font-mono text-[10px] text-slate-400">approved</span>
            </div>
          </div>

          {/* Main floating card */}
          <div className="animate-float relative w-[19rem] -rotate-1 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                C
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Budget approval — Q3</p>
                <p className="truncate text-xs text-slate-500">cfo@acme.com</p>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Awaiting
              </span>
            </div>

            <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">
              Requesting sign-off on the Q3 marketing budget. Details attached.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <Paperclip className="h-3 w-3" /> budget-q3.pdf
            </div>

            <div className="mt-4 flex gap-2">
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white">
                <Check className="h-3.5 w-3.5" /> Approve
              </span>
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600">
                <X className="h-3.5 w-3.5" /> Reject
              </span>
            </div>
          </div>
        </div>

        <StatStrip tone="onPrimary" />
      </div>
    </div>
  )
}
