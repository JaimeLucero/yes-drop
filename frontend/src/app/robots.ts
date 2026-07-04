import type { MetadataRoute } from 'next'

const BASE = 'https://www.yesdrop.online'

// Gated app + utility routes: crawlers get nothing useful, so keep them out of
// the index. Marketing pages (/, /privacy, /terms) stay allowed.
const DISALLOW = ['/dashboard', '/settings', '/requests', '/login', '/action', '/auth']

// AI answer-engine crawlers. Listed explicitly so our policy is intentional
// (allow the public site, mirror the same app-path exclusions).
const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
