#!/usr/bin/env tsx
// Screenshot capture orchestrator for PRC submission deck
// Captures all frames sequentially with copy extraction

import { chromium } from '@playwright/test';
import { ALL_FRAMES, type FrameDef } from './frames';
import { applySetup } from './state-helpers';
import { waitForAnimations } from './animation-wait';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.KIOSK_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.resolve(__dirname, '../../output/screenshots');
const SINGLE_FRAME = process.argv.find(a => a.startsWith('--frame='))?.split('=')[1];

async function extractCopy(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const textNodes = document.evaluate(
      '//text()[normalize-space(.)]',
      document.body,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    const copy: string[] = [];
    for (let i = 0; i < textNodes.snapshotLength; i++) {
      const node = textNodes.snapshotItem(i);
      const text = node?.textContent?.trim();
      if (text && text.length > 0 && !text.startsWith('{') && !text.startsWith('function')) {
        copy.push(text);
      }
    }
    // Dedupe while preserving order
    return [...new Set(copy)];
  });
}

async function captureFrame(
  page: import('@playwright/test').Page,
  frame: FrameDef,
): Promise<{ success: boolean; error?: string }> {
  const screenshotPath = path.join(OUTPUT_DIR, `${frame.id}.png`);
  const copyPath = path.join(OUTPUT_DIR, `${frame.id}.copy.json`);

  try {
    console.log(`  Capturing: ${frame.id} — ${frame.title}`);

    // Navigate with capture mode
    await page.goto(`${BASE_URL}?captureMode=true`, { waitUntil: 'networkidle' });

    // Apply frame-specific state
    await applySetup(page, frame.setup);

    // Wait for animations
    await waitForAnimations(page, frame.settleOverride);

    // Extract copy from DOM
    const copy = await extractCopy(page);
    fs.writeFileSync(copyPath, JSON.stringify(copy, null, 2));

    // Capture screenshot
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });

    console.log(`  ✓ ${frame.id} — ${copy.length} text nodes extracted`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${frame.id} — ${msg}`);
    return { success: false, error: msg };
  }
}

async function main() {
  // Ensure output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const frames = SINGLE_FRAME
    ? ALL_FRAMES.filter(f => f.id === SINGLE_FRAME)
    : ALL_FRAMES;

  if (frames.length === 0) {
    console.error(`No frame found matching: ${SINGLE_FRAME}`);
    process.exit(1);
  }

  console.log(`\n📸 Capturing ${frames.length} frames from ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const frame of frames) {
    const result = await captureFrame(page, frame);
    results.push({ id: frame.id, ...result });
  }

  await browser.close();

  // Summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n📊 Results: ${passed} captured, ${failed} failed out of ${results.length} total`);

  if (failed > 0) {
    console.log('\nFailed frames:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ✗ ${r.id}: ${r.error}`);
    });
    process.exit(1);
  }

  console.log(`\n✓ All screenshots saved to ${OUTPUT_DIR}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
