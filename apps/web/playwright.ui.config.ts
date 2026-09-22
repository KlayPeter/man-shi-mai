import { defineConfig, devices } from '@playwright/test'

// Isolated UI checks: every API request is mocked; no database or AI service required.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'ui-redesign.spec.ts',
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://localhost:8000', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
