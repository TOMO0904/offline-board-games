import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/offline-board-games/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node scripts/serve-test.mjs',
    url: 'http://127.0.0.1:4173/offline-board-games/',
    timeout: 120_000,
    reuseExistingServer: false,
  },
})
