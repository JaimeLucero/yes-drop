import { test, expect, type Page, type Route } from '@playwright/test'
import { signIn } from './support/auth'

// Everything external is mocked: Supabase auth and the YesDrop backend. No real
// keys, no Gmail, no provider calls. The backend mock mirrors /api/ai/*.
const BACKEND_URL = 'http://localhost:8000'
const SCREENSHOT_DIRECTORY =
  '/private/tmp/claude-501/-Users-jaimeemanuellucero-Projects-yes-drop/2aed33ee-a213-4c09-abd9-e0d56ba28313/scratchpad/screens'
const TEST_API_KEY = 'sk-ant-test-key-1234567890'
const REJECTED_API_KEY = 'invalid-test-key'
const VERIFIED_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
}

interface BackendMock {
  settings: { configured: boolean; provider: string | null; model: string | null }
  savedRequestBodies: Record<string, string>[]
  composeRequestBodies: Record<string, string>[]
  modelRequestBodies: Record<string, string>[]
}

async function mockBackend(page: Page, initialSettings: BackendMock['settings']): Promise<BackendMock> {
  const mock: BackendMock = {
    settings: initialSettings,
    savedRequestBodies: [],
    composeRequestBodies: [],
    modelRequestBodies: [],
  }

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
    if (path === '/api/ai/models') {
      const body = request.postDataJSON()
      mock.modelRequestBodies.push(body)
      if (body.api_key === REJECTED_API_KEY) {
        return json(route, { detail: 'Your AI provider rejected the key. Check it in Settings.' }, 400)
      }
      return json(route, { models: VERIFIED_MODELS })
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

function modelSelect(page: Page) {
  return page.getByRole('combobox', { name: 'Model' })
}

test.describe('AI provider settings', () => {
  test('verify the key, pick a model it can use, save, and never show the key back', async ({ page }) => {
    await signIn(page)
    const mock = await mockBackend(page, NOT_CONFIGURED)

    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'AI provider' })).toBeVisible()
    await page.getByRole('combobox', { name: 'Provider' }).selectOption('anthropic')

    await expect(modelSelect(page)).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save key' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Verify key' })).toBeDisabled()
    await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/1-before-verify.png`, fullPage: true })

    await page.getByLabel('API key').fill(TEST_API_KEY)
    await page.getByRole('button', { name: 'Verify key' }).click()

    await expect(page.getByText('Key verified. 3 recent models available.')).toBeVisible()
    expect(mock.modelRequestBodies).toEqual([{ provider: 'anthropic', api_key: TEST_API_KEY }])
    await expect(modelSelect(page)).toBeEnabled()
    await expect(modelSelect(page).locator('option')).toHaveText(VERIFIED_MODELS)
    await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/2-verified.png`, fullPage: true })

    await modelSelect(page).selectOption('claude-sonnet-5-5')
    await page.getByRole('button', { name: 'Save key' }).click()

    await expect(page.getByText('Anthropic Claude (claude-sonnet-5-5)')).toBeVisible()
    expect(mock.savedRequestBodies).toEqual([
      { provider: 'anthropic', model: 'claude-sonnet-5-5', api_key: TEST_API_KEY },
    ])
    await expect(page.getByLabel('API key')).toHaveValue('')
    expect(await page.content()).not.toContain(TEST_API_KEY)
    await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/3-saved.png`, fullPage: true })

    await page.getByRole('button', { name: 'Remove key' }).click()
    await expect(page.getByText('Add your own key to draft requests from a sentence.')).toBeVisible()
    expect(mock.settings.configured).toBe(false)
  })

  test('a rejected key never unlocks the model list or saving', async ({ page }) => {
    await signIn(page)
    const mock = await mockBackend(page, NOT_CONFIGURED)

    await page.goto('/settings')
    await page.getByLabel('API key').fill(REJECTED_API_KEY)
    await page.getByRole('button', { name: 'Verify key' }).click()

    await expect(page.getByText('Your AI provider rejected the key. Check it in Settings.')).toBeVisible()
    await expect(modelSelect(page)).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save key' })).toBeDisabled()
    expect(mock.savedRequestBodies).toHaveLength(0)
    await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/4-rejected-key.png`, fullPage: true })
  })

  test('editing the key or switching provider after verifying requires verifying again', async ({ page }) => {
    await signIn(page)
    await mockBackend(page, NOT_CONFIGURED)

    await page.goto('/settings')
    await page.getByLabel('API key').fill(TEST_API_KEY)
    await page.getByRole('button', { name: 'Verify key' }).click()
    await expect(modelSelect(page)).toBeEnabled()

    await page.getByLabel('API key').fill(`${TEST_API_KEY}x`)
    await expect(modelSelect(page)).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save key' })).toBeDisabled()

    await page.getByRole('button', { name: 'Verify key' }).click()
    await expect(modelSelect(page)).toBeEnabled()

    await page.getByRole('combobox', { name: 'Provider' }).selectOption('openai')
    await expect(modelSelect(page)).toBeDisabled()
    await expect(page.getByRole('link', { name: 'Get your OpenAI API key' })).toBeVisible()
  })
})

test.describe('AI compose on the new request page', () => {
  test('asks for a key until one is saved', async ({ page }) => {
    await signIn(page)
    await mockBackend(page, NOT_CONFIGURED)

    await page.goto('/requests/new')
    await expect(page.getByRole('link', { name: 'Add AI key' })).toHaveAttribute('href', '/settings')
    await expect(page.getByPlaceholder(/Ask my CFO Jane/)).toHaveCount(0)
    await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/5-new-request-no-key.png`, fullPage: true })
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
    await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/6-new-request-composed.png`, fullPage: true })
  })
})
