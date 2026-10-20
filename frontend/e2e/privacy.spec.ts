import { test, expect } from '@playwright/test'

test.describe('/privacy AI disclosure', () => {
  test('says AI compose uses the user\'s own key from a named provider', async ({ page }) => {
    await page.goto('/privacy')

    await expect(page.getByRole('heading', { name: 'AI features' })).toBeVisible()
    await expect(page.getByText('your own API key', { exact: false })).toBeVisible()
    await expect(page.getByText('Anthropic Claude')).toBeVisible()
    await expect(page.getByText('YesDrop does not supply an AI account', { exact: false })).toBeVisible()

    await expect(page.getByText(/opencode/i)).toHaveCount(0)
  })

  test('still states Google user data is never used to train AI models', async ({ page }) => {
    await page.goto('/privacy')

    await expect(
      page.getByText('to develop, improve, or train generalized or non-personalized AI', { exact: false })
    ).toBeVisible()
  })
})
