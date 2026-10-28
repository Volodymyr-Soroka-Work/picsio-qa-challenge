import { defineConfig, devices } from '@playwright/test';
import { APP_URL, STATE_FILE } from './support/settings.mjs';

export default defineConfig({
  testDir: '.',
  testMatch: ['video-player.spec.ts', 'video-network.spec.ts'],
  globalSetup: './preflight.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  globalTimeout: 15 * 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: APP_URL,
    storageState: STATE_FILE,
    actionTimeout: 10_000,
    navigationTimeout: 45_000,
    screenshot: 'only-on-failure',
    // Traces contain signed media URLs; opt in locally and never publish them.
    trace: process.env.PICSIO_TRACE === '1' ? 'retain-on-failure' : 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
