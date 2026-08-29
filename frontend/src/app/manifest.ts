import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YesDrop: email approvals on autopilot',
    short_name: 'YesDrop',
    description:
      'Send approval requests by email, set deadlines, and let automatic reminders chase the reply.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    icons: [
      { src: '/yesdrop-icon.png', sizes: 'any', type: 'image/png' },
      { src: '/yesdrop-icon.svg', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
