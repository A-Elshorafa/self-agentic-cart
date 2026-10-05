import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  // The backend cart is shared in memory, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    // Waiting on the proxied API means both the frontend and the backend are up.
    url: `${BASE_URL}/api/items`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
