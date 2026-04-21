import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/capture',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 2,
    screenshot: 'off',
  },
});
