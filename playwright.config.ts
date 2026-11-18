import { defineConfig, devices } from '@playwright/test';

const chromiumUse = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1280, height: 720 },
};

// CI installs Playwright's bundled Chromium. Do not set channel: 'chrome' there.
if (process.env.CI) {
  delete chromiumUse.channel;
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
    },
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: chromiumUse,
    },
  ],
  webServer: {
    command: 'npm run dev --workspace client',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
