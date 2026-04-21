// PDF export via Playwright page.pdf() — preserves real <a href> hyperlinks.
// Also runs an overflow audit before export; fails if any slide overflows.
//
// Run:  node scripts/export-pdf-v2.mjs
// Output: care-for-the-culture-prc-final-v2.pdf in repo root

import { chromium } from 'playwright';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

const ROOT = resolve(process.cwd());
const OUT_PDF = join(ROOT, 'care-for-the-culture-prc-final-v2.pdf');
const INDEX = pathToFileURL(join(ROOT, 'index.html')).toString();

// Paper size matches @page rule in index.html (11in x 8.5in landscape letter).
const PDF_WIDTH = '11in';
const PDF_HEIGHT = '8.5in';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

console.log('Loading deck:', INDEX);
await page.goto(INDEX, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// Force all slides visible and trigger fit-text on each before audit.
const total = await page.evaluate(() => document.querySelectorAll('.slide').length);
console.log(`Total slides: ${total}`);

// Reveal every slide so fitAll/auditOverflow can measure real heights.
await page.addStyleTag({ content: `
  .slide { display: block !important; position: relative !important; }
  .slide.slide-cover { display: flex !important; }
  .slide[style*="display:flex"], .slide[style*="display: flex"] { display: flex !important; }
  .slide-nav { display: none !important; }
` });

await page.waitForTimeout(400);

// Run fit + audit.
const report = await page.evaluate(() => {
  if (typeof window.fitAll === 'function') window.fitAll();
  if (typeof window.auditOverflow === 'function') return window.auditOverflow();
  return [];
});

const overflowing = report.filter(r => r.annOverflow || r.slideOverflow);
if (overflowing.length > 0) {
  console.error('\n❌ OVERFLOW DETECTED on these slides:');
  for (const r of overflowing) {
    console.error(`  slide #${r.index}  annOverflow=${r.annOverflow}  slideOverflow=${r.slideOverflow}  scrollH=${r.scrollH}  clientH=${r.clientH}`);
  }
  console.error(`\nFail: ${overflowing.length} slide(s) overflow. Tighten copy or shrink media before export.`);
  await browser.close();
  process.exit(1);
}
console.log(`✅ Overflow audit passed (${total} slides).`);

// Emit PDF using print media so @media print rules + @page apply.
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(500);

await page.pdf({
  path: OUT_PDF,
  width: PDF_WIDTH,
  height: PDF_HEIGHT,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

console.log(`\n✅ PDF written: ${OUT_PDF}`);

await browser.close();
