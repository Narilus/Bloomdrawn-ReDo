import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    browserName: 'chromium',
    viewport: { width: 1920, height: 1080 },
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
  },
});
