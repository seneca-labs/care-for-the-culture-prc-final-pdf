#!/usr/bin/env tsx
// HTML deck assembler + PDF export for PRC submission

import * as fs from 'fs';
import * as path from 'path';
import type { FrameAnnotation } from '../annotations/schema';

const OUTPUT_DIR = path.resolve(__dirname, '../../output');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const ANNOTATIONS_PATH = path.resolve(__dirname, '../annotations/annotations.json');
const CSS_PATH = path.resolve(__dirname, 'styles/deck.css');

function getVersion(): number {
  const existing = fs.readdirSync(OUTPUT_DIR).filter(f => f.match(/^deck-v\d+\.html$/));
  if (existing.length === 0) return 1;
  const versions = existing.map(f => parseInt(f.match(/v(\d+)/)?.[1] || '0'));
  return Math.max(...versions) + 1;
}

function loadAnnotations(): FrameAnnotation[] {
  if (!fs.existsSync(ANNOTATIONS_PATH)) {
    console.warn('⚠ No annotations.json found. Generating deck with screenshots only.');
    return [];
  }
  return JSON.parse(fs.readFileSync(ANNOTATIONS_PATH, 'utf-8'));
}

function loadExtractedCopy(frameId: string): string[] {
  const copyPath = path.join(SCREENSHOTS_DIR, `${frameId}.copy.json`);
  if (!fs.existsSync(copyPath)) return [];
  return JSON.parse(fs.readFileSync(copyPath, 'utf-8'));
}

function renderAnnotationSection(title: string, content: string): string {
  if (!content.trim()) return '';
  return `<div class="annotation-section"><h4>${title}</h4>${content}</div>`;
}

function renderFramePage(annotation: FrameAnnotation | null, frameId: string, frameTitle: string): string {
  const screenshotFile = `${frameId}.png`;
  const screenshotExists = fs.existsSync(path.join(SCREENSHOTS_DIR, screenshotFile));
  const copy = loadExtractedCopy(frameId);

  const variantBadge = annotation?.variantId
    ? `<span class="variant-label ${annotation.variantId === 'connected' ? 'variant-connected' : 'variant-new'}">${annotation.variantId}</span>`
    : '';

  let annotationsHtml = '';

  if (annotation) {
    // Part number
    annotationsHtml += `<div class="annotation-section"><h4>Part Number</h4><span class="part-number-field" data-comment="Majority to provide part number before final submission">${annotation.partNumber || '_______________'}</span></div>`;

    // Purpose & Intent
    if (annotation.purposeAndIntent) {
      annotationsHtml += renderAnnotationSection('Purpose & Intent',
        `<p><strong>Summary:</strong> ${annotation.purposeAndIntent.summary}</p>
         <p><strong>User action:</strong> ${annotation.purposeAndIntent.userAction}</p>`);
    }

    // Legal & Compliance
    if (annotation.legalAndComplianceLanguage) {
      const l = annotation.legalAndComplianceLanguage;
      annotationsHtml += renderAnnotationSection('Legal & Compliance Language',
        `<p><strong>Exact copy on screen:</strong> "${l.copyExcerpt}"</p>
         <p><strong>Why this language is here:</strong> ${l.purpose}</p>
         <p><strong>Stakeholder guidance that shaped this:</strong></p>
         <ul>${l.stakeholderGuidance.map(s => `<li>${s}</li>`).join('')}</ul>
         <p><strong>Concerns this addresses:</strong></p>
         <ul>${l.concernsAddressed.map(c => `<li>${c}</li>`).join('')}</ul>
         <p><strong>Legal basis:</strong> ${l.basis}</p>`);
    }

    // Variant Copy
    if (annotation.variantCopy) {
      annotationsHtml += renderAnnotationSection('Customized Copy by PrEP Answer',
        `<p><strong>Connected:</strong> "${annotation.variantCopy.connected}"</p>
         <p><strong>New/Skipped:</strong> "${annotation.variantCopy.newOrSkipped}"</p>
         <p><strong>Rationale:</strong> ${annotation.variantCopy.rationale}</p>`);
    }

    // Data Calculation
    if (annotation.dataCalculation) {
      const d = annotation.dataCalculation;
      annotationsHtml += renderAnnotationSection('How the Data Is Calculated',
        `<p><strong>Source:</strong> ${d.source}</p>
         <p><strong>Fields used:</strong> ${d.fieldsUsed.join(', ')}</p>
         <p><strong>How we calculate it:</strong> ${d.calculationMethod}</p>
         <p><strong>Any AI or algorithmic inference:</strong> ${d.aiOrAlgorithmicInference}</p>`);
    }

    // Data Visualization
    if (annotation.dataVisualization) {
      annotationsHtml += renderAnnotationSection('How the Data Is Visualized',
        `<p>${annotation.dataVisualization.description}</p>
         <p><strong>Why this visual treatment:</strong> ${annotation.dataVisualization.rationale}</p>`);
    }
  } else {
    annotationsHtml += `<div class="annotation-section"><h4>Part Number</h4><span class="part-number-field">_______________</span></div>`;
    annotationsHtml += `<div class="annotation-section"><p><em>Annotation pending — status: drafted</em></p></div>`;
  }

  // Copy on Frame (verbatim from DOM)
  if (copy.length > 0) {
    annotationsHtml += renderAnnotationSection('Copy on Frame (Verbatim)',
      `<div class="copy-verbatim">${copy.join('\n')}</div>`);
  }

  return `
    <div class="frame-page">
      <div class="frame-header">
        <h3>${frameTitle}${variantBadge}</h3>
        <span style="font-size: 9pt; color: var(--color-muted);">${frameId}</span>
      </div>
      <div class="frame-screenshot">
        ${screenshotExists
          ? `<img src="screenshots/${screenshotFile}" alt="${frameTitle}" />`
          : `<div style="width:100%;height:400px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px;color:#999;">Screenshot pending</div>`}
      </div>
      <div class="frame-annotations">${annotationsHtml}</div>
    </div>`;
}

function buildDeck(): string {
  const css = fs.readFileSync(CSS_PATH, 'utf-8');
  const annotations = loadAnnotations();
  const version = getVersion();
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Build frame pages from annotations or frame definitions
  const { ALL_FRAMES } = require('../capture/frames');
  const framePages = ALL_FRAMES.map((frame: any) => {
    const annotation = annotations.find((a: FrameAnnotation) => a.frameId === frame.id) || null;
    return renderFramePage(annotation, frame.id, frame.title);
  }).join('\n');

  // TOC
  const tocEntries = ALL_FRAMES.map((f: any, i: number) =>
    `<div class="toc-entry"><span>${f.title}</span><span>Page ${i + 4}</span></div>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Care for the Culture — PRC Submission v${version}</title>
  <style>${css}</style>
</head>
<body>

  <!-- Cover -->
  <div class="cover-page">
    <h1>Care for the Culture</h1>
    <h2>Kiosk Experience — PRC Submission</h2>
    <div class="meta">
      <p>Freddy Events, NYC + LA</p>
      <p>Submission Date: ${date}</p>
      <p>Version: v${version}</p>
      <p>Submitting Agency: Majority</p>
      <p>Production: Vega Studios + Seneca Labs</p>
      <p style="margin-top: 0.3in;">Part Number: <span class="part-number-field">_______________</span></p>
    </div>
  </div>

  <!-- Table of Contents -->
  <div class="toc-page">
    <h2>Table of Contents</h2>
    ${tocEntries}
  </div>

  <!-- Frame Pages -->
  ${framePages}

</body>
</html>`;
}

async function main() {
  const version = getVersion();
  const htmlPath = path.join(OUTPUT_DIR, `deck-v${version}.html`);

  console.log(`\n📄 Building PRC deck v${version}\n`);

  const html = buildDeck();
  fs.writeFileSync(htmlPath, html);
  console.log(`✓ HTML deck: ${htmlPath}`);

  // PDF export via Playwright
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

    const pdfPath = path.join(OUTPUT_DIR, `PRC-Submission-v${version}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });
    await browser.close();
    console.log(`✓ PDF export: ${pdfPath}`);
  } catch (err) {
    console.warn(`⚠ PDF export failed: ${err}. HTML deck is still available.`);
  }

  console.log(`\n✓ Deck v${version} complete\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
