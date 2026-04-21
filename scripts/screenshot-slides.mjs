import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

const ROOT = resolve(process.cwd());
const OUT = join(ROOT, 'output', 'slide-shots');
mkdirSync(OUT, { recursive: true });

const W = 1920;
const H = 1080;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const url = pathToFileURL(join(ROOT, 'index.html')).toString();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const total = await page.evaluate(() => document.querySelectorAll('.slide').length);
console.log(`Total slides: ${total}`);

const pdfPages = [];

// Screenshots already exist from prior run; skip if present to save time
import { existsSync } from 'fs';
for (let i = 0; i < total; i++) {
  const file = join(OUT, `slide-${String(i + 1).padStart(2, '0')}.png`);
  if (existsSync(file) && process.env.SKIP_SHOTS === '1') continue;
  await page.evaluate((n) => window.showSlide(n), i);
  await page.waitForTimeout(500);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  saved ${file}`);
}

// Build a single PDF from all screenshots by rendering an HTML gallery
const imgs = Array.from({ length: total }, (_, i) => {
  const abs = pathToFileURL(join(OUT, `slide-${String(i + 1).padStart(2, '0')}.png`)).toString();
  return `<img src="${abs}" style="display:block;width:1920px;height:1080px;object-fit:contain;page-break-after:always;page-break-inside:avoid;">`;
}).join('\n');

const html = `<!DOCTYPE html><html><head><style>
@page { size: 1920px 1080px; margin: 0; }
html,body { margin:0; padding:0; background:#000; }
</style></head><body>${imgs}</body></html>`;

const galleryPath = join(ROOT, '_gallery.html');
const { writeFileSync } = await import('fs');
writeFileSync(galleryPath, html);

const pdfPage = await context.newPage();
await pdfPage.goto(pathToFileURL(galleryPath).toString(), { waitUntil: 'networkidle' });
await pdfPage.pdf({
  path: join(ROOT, 'care-for-the-culture-prc-final.pdf'),
  width: '1920px',
  height: '1080px',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
console.log(`PDF written to care-for-the-culture-prc-final.pdf`);

await browser.close();
