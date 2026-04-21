// State-setting helpers for programmatic kiosk control during capture
// These call window.__captureMode methods exposed by the kiosk app

import type { Page } from '@playwright/test';
import type { CaptureSetup } from './frames';

export async function applySetup(page: Page, setup: CaptureSetup): Promise<void> {
  // Set zip code
  if (setup.zipCode) {
    await page.evaluate((zip) => {
      window.__captureMode?.setZipCode(zip);
    }, setup.zipCode);
  }

  // Set prep answer
  if (setup.prepAnswer) {
    await page.evaluate((answer) => {
      window.__captureMode?.setPrepAnswer(answer as 'connected' | 'new-skipped');
    }, setup.prepAnswer === 'new' || setup.prepAnswer === 'skipped' ? 'new-skipped' : setup.prepAnswer);
  }

  // Navigate to screen
  await page.evaluate((screen) => {
    window.__captureMode?.navigateTo(screen);
  }, setup.screen);

  // Set slider year (frame 8)
  if (setup.sliderYear !== undefined) {
    await page.evaluate((year) => {
      window.__captureMode?.setFrame8SliderPosition(year);
    }, setup.sliderYear);
  }

  // Set borough sentence index (frame 9)
  if (setup.boroughSentenceIndex !== undefined) {
    await page.evaluate((idx) => {
      window.__captureMode?.setFrame9BoroughSentenceIndex(idx);
    }, setup.boroughSentenceIndex);
  }

  // Set card index (frame 11)
  if (setup.cardIndex !== undefined) {
    await page.evaluate((idx) => {
      window.__captureMode?.setCardIndex(idx);
    }, setup.cardIndex);
  }

  // Simulate drag progress (frame 11 card 5)
  if (setup.dragPercent !== undefined) {
    await page.evaluate((pct) => {
      window.__captureMode?.simulateDragProgress(pct);
    }, setup.dragPercent);
  }
}

// Type declaration for the kiosk's capture mode API
declare global {
  interface Window {
    __captureMode?: {
      navigateTo: (frameId: string) => Promise<void>;
      setPrepAnswer: (answer: 'connected' | 'new-skipped') => void;
      setZipCode: (zip: string) => void;
      setCardIndex: (index: number) => void;
      simulateDragProgress: (percent: number) => Promise<void>;
      setFrame8SliderPosition: (year: number) => void;
      setFrame9BoroughSentenceIndex: (index: number) => void;
      getAnimationsComplete: () => boolean;
    };
  }
}
