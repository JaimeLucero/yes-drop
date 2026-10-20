import type { Page } from '@playwright/test'

const SUPABASE_PROJECT_REF = 'aurhheqwpfpngqmhegvx'

function toBase64Url(text: string): string {
  return Buffer.from(text).toString('base64url')
}

export async function signIn(page: Page) {
  await page.addInitScript(() => localStorage.setItem('yesdrop_consent', 'denied'))
  const user = {
    id: 'user-1',
    aud: 'authenticated',
    email: 'tester@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }
  const session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  }
  await page.context().addCookies([
    {
      name: `sb-${SUPABASE_PROJECT_REF}-auth-token`,
      value: `base64-${toBase64Url(JSON.stringify(session))}`,
      url: 'http://localhost:3000',
    },
  ])
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
  )
}
