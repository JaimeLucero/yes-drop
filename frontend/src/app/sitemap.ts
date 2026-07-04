import type { MetadataRoute } from 'next'

const BASE = 'https://www.yesdrop.online'

// Public, indexable pages only. Gated app/auth routes are intentionally
// excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: `${BASE}/`, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${BASE}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
