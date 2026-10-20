import { test, expect } from '@playwright/test'
import { signIn } from './support/auth'

const BACKEND_URL = 'http://localhost:8000'
const SCREENSHOT_DIRECTORY =
  '/private/tmp/claude-501/-Users-jaimeemanuellucero-Projects-yes-drop/2aed33ee-a213-4c09-abd9-e0d56ba28313/scratchpad/screens'
const EXISTING_REQUEST = {
  id: 'request-1',
  user_id: 'user-1',
  requester_email: 'tester@example.com',
  sender_email: null,
  sender_name: null,
  approver_email: 'jane@acme.com',
  title: 'Q3 Marketing Budget',
  message: null,
  file_url: null,
  feedback: null,
  viewed_at: null,
  view_count: 0,
  status: 'pending',
  scheduled_send_at: null,
  sent_at: '2026-10-20T00:00:00Z',
  deadline: '2026-10-23T00:00:00Z',
  deadline_days: 3,
  follow_up_strategy: null,
  created_at: '2026-10-20T00:00:00Z',
  updated_at: '2026-10-20T00:00:00Z',
}
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
}

test('dashboard has no daily request limit card and never asks for one', async ({ page }) => {
  await signIn(page)
  const requestedPaths: string[] = []

  await page.route(`${BACKEND_URL}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    requestedPaths.push(path)
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })

    const bodyByPath: Record<string, unknown> = {
      '/api/requests': [EXISTING_REQUEST],
      '/api/stats/me': { total: 1, by_status: { pending: 1 } },
      '/api/google/status': { connected: true, email: 'tester@example.com' },
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(bodyByPath[path] ?? {}),
    })
  })

  await page.goto('/dashboard')
  await expect(page.getByText('Select a request to see its details, or start a new one.')).toBeVisible()

  await expect(page.getByText(/requests used today/)).toHaveCount(0)
  await expect(page.getByText('Daily usage')).toHaveCount(0)
  expect(requestedPaths).not.toContain('/api/requests/limit')
  await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/7-dashboard-no-limit.png`, fullPage: true })
})
