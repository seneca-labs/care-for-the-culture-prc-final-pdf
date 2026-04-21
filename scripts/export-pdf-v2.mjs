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
  // Viewport sized to the PDF page (11in x 8.5in @ 96dpi) so the audit
  // measures the same pixel layout the PDF renderer will produce.
  viewport: { width: 1056, height: 816 },
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
// Inject high-specificity overrides at end of <body> so they beat the existing
// in-body <style> block. Use html.pdf-export prefix for higher specificity.
await page.evaluate(() => {
  document.documentElement.classList.add('pdf-export');
  document.querySelectorAll('.slide').forEach(s => s.classList.add('active'));
  const style = document.createElement('style');
  style.id = 'pdf-export-overrides';
  style.textContent = `
    html.pdf-export, html.pdf-export body { background: #fff !important; overflow: visible !important; height: auto !important; }
    html.pdf-export .slide-nav { display: none !important; }
    html.pdf-export .slide {
      display: block !important;
      position: relative !important;
      box-sizing: border-box !important;
      width: 11in !important;
      height: 8.5in !important;
      overflow: hidden !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      box-shadow: none !important;
      margin: 0 !important;
    }
    html.pdf-export .slide:last-child { page-break-after: auto !important; break-after: auto !important; }
    html.pdf-export .slide.slide-cover {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
    }
    html.pdf-export .slide.slide-frame {
      display: grid !important;
      grid-template-columns: 30% 1fr !important;
      grid-template-rows: auto minmax(0, 1fr) !important;
      grid-template-areas: "header header" "screenshot annotations" !important;
      padding: 0.3in 0.5in 0.45in 0.5in !important;
      gap: 0.12in 0.35in !important;
      background: #EFE4CE !important;
    }
    html.pdf-export .slide.slide-frame .frame-header { grid-area: header !important; }
    html.pdf-export .slide.slide-frame .frame-screenshot {
      grid-area: screenshot !important;
      min-height: 0 !important;
      min-width: 0 !important;
      overflow: hidden !important;
      display: flex !important;
      align-items: flex-start !important;
      justify-content: center !important;
    }
    html.pdf-export .slide.slide-frame .frame-screenshot img {
      max-width: 100% !important;
      max-height: 100% !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
    }
    html.pdf-export .slide.slide-frame .frame-annotations {
      grid-area: annotations !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }
    /* Force annotation children to inherit the auto-fit font-size set on .frame-annotations */
    html.pdf-export .slide.slide-frame .frame-annotations p,
    html.pdf-export .slide.slide-frame .frame-annotations li,
    html.pdf-export .slide.slide-frame .frame-annotations .copy-verbatim,
    html.pdf-export .slide.slide-frame .frame-annotations .data-callout,
    html.pdf-export .slide.slide-frame .frame-annotations .callout-box,
    html.pdf-export .slide.slide-frame .frame-annotations .reviewer-note,
    html.pdf-export .slide.slide-frame .frame-annotations .reviewer-note p,
    html.pdf-export .slide.slide-frame .frame-annotations .part-number-label,
    html.pdf-export .slide.slide-frame .frame-annotations .part-number-field { font-size: inherit !important; }
    html.pdf-export .slide.slide-frame .frame-annotations h4 { font-size: 0.92em !important; }
    /* US-UNBC-4189 stamp must always sit at the bottom edge */
    html.pdf-export .slide .slide-footer-stamp {
      position: absolute !important;
      bottom: 0.18in !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      text-align: center !important;
      z-index: 10 !important;
    }
    /* Image-only slides keep flex centering */
    html.pdf-export .slide[style*="display:flex"],
    html.pdf-export .slide[style*="display: flex"] { display: flex !important; }
  `;
  document.body.appendChild(style);
});

await page.waitForTimeout(400);

// Switch to print media BEFORE measuring so audit sees the same layout the PDF will use.
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(400);

// Run fit + audit.
const report = await page.evaluate(() => {
  if (typeof window.fitAll === 'function') window.fitAll();
  // Stronger audit: also look at last child's bottom edge vs container.
  return Array.from(document.querySelectorAll('.slide')).map((s, i) => {
    const ann = s.querySelector('.frame-annotations');
    let annOverflow = false;
    let lastChildClipped = false;
    let lastChildText = '';
    if (ann) {
      annOverflow = ann.scrollHeight > ann.clientHeight + 1;
      const annRect = ann.getBoundingClientRect();
      const last = ann.lastElementChild;
      if (last) {
        const lr = last.getBoundingClientRect();
        // If the last block's bottom edge falls outside ann's box, content is clipped
        lastChildClipped = lr.bottom > annRect.bottom + 1;
        // Drill into last copy-verbatim to see its visible bottom text
        const cv = last.querySelector('.copy-verbatim') || (last.classList && last.classList.contains('copy-verbatim') ? last : null);
        if (cv) {
          const txt = (cv.textContent || '').trim().split('\n').filter(Boolean);
          lastChildText = txt[txt.length - 1] || '';
        }
      }
    }
    const slideOverflow = s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1;
    // Also check screenshot horizontal overflow
    const shot = s.querySelector('.frame-screenshot');
    let shotOverflow = false;
    if (shot) {
      shotOverflow = shot.scrollWidth > shot.clientWidth + 1;
    }
    const h3 = s.querySelector('h3, h1');
    return { index: i + 1, title: h3 ? h3.textContent.trim().slice(0, 50) : '?', annOverflow, lastChildClipped, slideOverflow, shotOverflow, lastChildText };
  });
});

const failed = report.filter(r => r.annOverflow || r.slideOverflow || r.shotOverflow || r.lastChildClipped);
if (failed.length > 0) {
  console.error('\n❌ OVERFLOW DETECTED on these slides:');
  for (const r of failed) {
    console.error(`  slide #${r.index} (${r.title})  ann=${r.annOverflow} lastClipped=${r.lastChildClipped} slide=${r.slideOverflow} shotW=${r.shotOverflow}  last="${r.lastChildText}"`);
  }
  console.error(`\nFail: ${failed.length} slide(s) overflow.`);
  await browser.close();
  process.exit(1);
}
console.log(`✅ Overflow audit passed (${total} slides) in print mode.`);

await page.waitForTimeout(300);

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
