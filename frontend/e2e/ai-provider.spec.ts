import { test, expect, type Page, type Route } from '@playwright/test'

// Everything external is mocked: Supabase auth and the YesDrop backend. No real
// keys, no Gmail, no provider calls. The backend mock mirrors /api/ai/settings.
const SUPABASE_PROJECT_REF = 'aurhheqwpfpngqmhegvx'
const BACKEND_URL = 'http://localhost:8000'
const SCREENSHOT_DIRECTORY =
  '/private/tmp/claude-501/-Users-jaimeemanuellucero-Projects-yes-drop/2aed33ee-a213-4c09-abd9-e0d56ba28313/scratchpad/screens'
const TEST_API_KEY = 'sk-ant-test-key-1234567890'
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
}

interface BackendMock {
  settings: { configured: boolean; provider: string | null; model: string | null }
  savedRequestBodies: Record<string, string>[]
  composeRequestBodies: Record<string, string>[]
}

function toBase64Url(text: string): string {
  return Buffer.from(text).toString('base64url')
}

async function signIn(page: Page) {
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

async function mockBackend(page: Page, initialSettings: BackendMock['settings']): Promise<BackendMock> {
  const mock: BackendMock = { settings: initialSettings, savedRequestBodies: [], composeRequestBodies: [] }

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', headers: CORS_HEADERS, body: JSON.stringify(body) })

  await page.route(`${BACKEND_URL}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })

    if (path === '/api/ai/settings' && request.method() === 'GET') return json(route, mock.settings)
    if (path === '/api/ai/settings' && request.method() === 'PUT') {
      const body = request.postDataJSON()
      mock.savedRequestBodies.push(body)
      mock.settings = { configured: true, provider: body.provider, model: body.model }
      return json(route, mock.settings)
    }
    if (path === '/api/ai/settings' && request.method() === 'DELETE') {
      mock.settings = { configured: false, provider: null, model: null }
      return json(route, { success: true })
    }
    if (path === '/api/compose') {
      mock.composeRequestBodies.push(request.postDataJSON())
      return json(route, {
        approver_email: 'jane@acme.com',
        title: 'Q3 Marketing Budget',
        message: 'Please approve the Q3 marketing budget.',
        deadline: '2030-01-04T00:00:00+00:00',
        scheduled_send_at: null,
        reminders: [],
      })
    }
    if (path === '/api/google/status') return json(route, { connected: true, email: 'tester@example.com' })
    return json(route, {})
  })
  return mock
}

const NOT_CONFIGURED = { configured: false, provider: null, model: null }

test.describe('AI provider settings', () => {
  test('configure, save and remove a Claude key without ever showing it back', async ({ page }) => {
    await signIn(page)
    const mock = await mockBackend(page, NOT_CONFIGURED)

    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'AI provider' })).toBeVisible()
    await expect(page.getByText('Add your own key to draft requests from a sentence.')).toBeVisible()

    await page.getByRole('combobox', { name: 'Provider' }).selectOption('anthropic')
    await expect(page.getByRole('textbox', { name: 'Model' })).toHaveValue('claude-haiku-5-5')
    await expect(page.getByRole('link', { name: 'Get your Anthropic Claude API key' })).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/1-settings-before-save.png`, fullPage: true })

    await page.getByLabel('API key').fill(TEST_API_KEY)
    await page.getByRole('button', { name: 'Save key' }).click()

    await expect(page.getByText('Anthropic Claude (claude-haiku-5-5)')).toBeVisible()
    expect(mock.savedRequestBodies).toEqual([
      { provider: 'anthropic', model: 'claude-haiku-5-5', api_key: TEST_API_KEY },
    ])
    await expect(page.getByLabel('API key')).toHaveValue('')
    expect(await page.content()).not.toContain(TEST_API_KEY)
    await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/2-settings-saved.png`, fullPage: true })

    await page.getByRole('button', { name: 'Remove key' }).click()
    await expect(page.getByText('Add your own key to draft requests from a sentence.')).toBeVisible()
    expect(mock.settings.configured).toBe(false)
  })

  test('switching provider swaps the default model and key link', async ({ page }) => {
    await signIn(page)
    await mockBackend(page, NOT_CONFIGURED)

    await page.goto('/settings')
    for (const [provider, model, linkName] of [
      ['openai', 'gpt-4o-mini', 'Get your OpenAI API key'],
      ['gemini', 'gemini-2.5-flash', 'Get your Google Gemini API key'],
    ]) {
      await page.getByRole('combobox', { name: 'Provider' }).selectOption(provider)
      await expect(page.getByRole('textbox', { name: 'Model' })).toHaveValue(model)
      await expect(page.getByRole('link', { name: linkName })).toBeVisible()
    }
  })
})

test.describe('AI compose on the new request page', () => {
  test('asks for a key until one is saved', async ({ page }) => {
    await signIn(page)
    await mockBackend(page, NOT_CONFIGURED)

    await page.goto('/requests/new')
    await expect(page.getByRole('link', { name: 'Add AI key' })).toHaveAttribute('href', '/settings')
    await expect(page.getByPlaceholder(/Ask my CFO Jane/)).toHaveCount(0)
    await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/3-new-request-no-key.png`, fullPage: true })
  })

  test('composes with a saved key and prefills the form', async ({ page }) => {
    await signIn(page)
    const mock = await mockBackend(page, { configured: true, provider: 'anthropic', model: 'claude-haiku-5-5' })

    await page.goto('/requests/new')
    await page.getByPlaceholder(/Ask my CFO Jane/).fill('Ask Jane (jane@acme.com) to approve the Q3 budget')
    await page.getByRole('button', { name: 'Compose' }).click()

    await expect(page.locator('#approver_email')).toHaveValue('jane@acme.com')
    expect(mock.composeRequestBodies).toHaveLength(1)
    expect(mock.composeRequestBodies[0].prompt).toContain('Q3 budget')
    await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/4-new-request-composed.png`, fullPage: true })
  })
})
