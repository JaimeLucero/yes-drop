import { ImageResponse } from 'next/og'

export const alt = 'YesDrop: email approvals on autopilot'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Branded 1200x630 social/AI-preview card, generated at build time. Replaces the
// raw logo previously used for og:image so shares render a proper card.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 55%, #0ea5e9 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: 40,
            fontWeight: 700,
            opacity: 0.95,
          }}
        >
          YesDrop
        </div>
        <div
          style={{
            marginTop: '28px',
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            maxWidth: '900px',
          }}
        >
          Approvals that don&apos;t need chasing
        </div>
        <div
          style={{
            marginTop: '28px',
            fontSize: 34,
            fontWeight: 400,
            lineHeight: 1.3,
            maxWidth: '820px',
            opacity: 0.9,
          }}
        >
          Send an approval request by email, set a deadline, and let automatic reminders chase the reply.
        </div>
      </div>
    ),
    { ...size }
  )
}
