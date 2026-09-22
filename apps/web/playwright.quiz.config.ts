import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'quiz-local.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:8022', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
