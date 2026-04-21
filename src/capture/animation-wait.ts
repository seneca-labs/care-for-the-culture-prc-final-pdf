// Post-animation detection — waits for kiosk animations to settle

import type { Page } from '@playwright/test';

export async function waitForAnimations(page: Page, additionalMs: number = 0): Promise<void> {
  const BASE_SETTLE = 2500;
  const totalWait = BASE_SETTLE + additionalMs;

  await page.waitForTimeout(totalWait);

  // Secondary check: poll getAnimationsComplete if available
  try {
    const complete = await page.evaluate(() => {
      return window.__captureMode?.getAnimationsComplete?.() ?? true;
    });
    if (!complete) {
      // Extra 1s buffer if animations haven't settled
      await page.waitForTimeout(1000);
    }
  } catch {
    // If helper doesn't exist, settle time is sufficient
  }
}
