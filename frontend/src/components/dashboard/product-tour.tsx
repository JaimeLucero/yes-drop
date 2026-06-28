'use client'

import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

const TOUR_KEY = 'yesdrop:tour:v1'

export function tourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === 'done'
  } catch {
    return false
  }
}

function markDone() {
  try {
    localStorage.setItem(TOUR_KEY, 'done')
  } catch {
    /* ignore */
  }
}

// Keep only steps whose target is actually rendered + visible (handles the
// collapsed sidebar and mobile drawer, where some anchors are hidden).
function visibleSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((s) => {
    if (!s.element || typeof s.element !== 'string') return true
    const el = document.querySelector(s.element)
    return !!el && (el as HTMLElement).getClientRects().length > 0
  })
}

/** Tour over the dashboard, ending by sending the user into the create form. */
export function startDashboardTour(navigate: (href: string) => void) {
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const steps: DriveStep[] = [
    {
      popover: {
        title: 'Welcome to YesDrop 👋',
        description: 'A 30-second tour of how approvals work here. You can skip anytime.',
      },
    },
    {
      element: '[data-tour="new-request"]',
      popover: { title: 'Send a request', description: 'Start an approval request — by email — from here.' },
    },
    {
      element: '[data-tour="folders"]',
      popover: {
        title: 'Track by status',
        description: 'Drafts, scheduled, sent, approved, rejected — every request, organized.',
      },
    },
    {
      element: '[data-tour="search"]',
      popover: { title: 'Find anything', description: 'Search by title, approver, or message. Press ⌘K to jump here.' },
    },
    {
      element: '[data-tour="request-list"]',
      popover: { title: 'Your requests', description: 'Each request lands in this list. Click one to open it.' },
    },
    {
      element: '[data-tour="detail"]',
      popover: {
        title: 'Details & actions',
        description: 'Open a request to send, edit, schedule, set reminders, or preview the approval page.',
      },
    },
    {
      element: '[data-tour="daily-limit"]',
      popover: { title: 'Daily limit', description: 'Your sending allowance for the day, so nothing runs away.' },
    },
  ]

  const finalStep: DriveStep = {
    popover: {
      title: 'Send your first request',
      description: "That's the tour. Let's create your first approval request now.",
      nextBtnText: 'Create one →',
    },
  }

  const d = driver({
    showProgress: true,
    animate: !reduceMotion,
    steps: [...visibleSteps(steps), finalStep],
    onNextClick: () => {
      if (d.hasNextStep()) {
        d.moveNext()
      } else {
        markDone()
        d.destroy()
        navigate('/requests/new?tour=1')
      }
    },
    onDestroyed: markDone,
  })
  d.drive()
}

/** Second leg: walk the create-request form fields. */
export function startCreateFormTour() {
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const steps: DriveStep[] = [
    {
      element: '[data-tour="approver"]',
      popover: { title: 'Who approves?', description: 'Enter the approver’s email — they don’t need an account.' },
    },
    {
      element: '[data-tour="title"]',
      popover: { title: 'What’s it for?', description: 'A short title so the approver knows what they’re deciding on.' },
    },
    {
      element: '[data-tour="deadline"]',
      popover: {
        title: 'Deadline & reminders',
        description: 'Set a respond-by date and automatic reminders chase non-responders for you.',
      },
    },
    {
      element: '[data-tour="attachments"]',
      popover: { title: 'Add context', description: 'Attach a file so the approver has everything they need.' },
    },
    {
      element: '[data-tour="submit"]',
      popover: { title: 'Send it', description: 'Send now, save a draft, or schedule it — then you’re done.' },
    },
  ]

  const d = driver({
    showProgress: true,
    animate: !reduceMotion,
    steps: visibleSteps(steps),
    onDestroyed: markDone,
  })
  d.drive()
}
