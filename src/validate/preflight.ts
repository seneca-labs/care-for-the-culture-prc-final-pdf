#!/usr/bin/env tsx
// Pre-flight validation for PRC deck assembly

import * as fs from 'fs';
import * as path from 'path';
import { ALL_FRAMES } from '../capture/frames';
import type { FrameAnnotation } from '../annotations/schema';

const OUTPUT_DIR = path.resolve(__dirname, '../../output/screenshots');
const ANNOTATIONS_PATH = path.resolve(__dirname, '../annotations/annotations.json');
const SOURCE_DIR = path.resolve(__dirname, '../../source-materials');
const DESIGN_DIR = path.resolve(__dirname, '../../design');
const ALLOW_DRAFTED = process.argv.includes('--allow-drafted');

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

function run(): Check[] {
  const checks: Check[] = [];

  // 1. Screenshots exist
  for (const frame of ALL_FRAMES) {
    const p = path.join(OUTPUT_DIR, `${frame.id}.png`);
    const exists = fs.existsSync(p);
    const size = exists ? fs.statSync(p).size : 0;
    checks.push({
      name: `Screenshot: ${frame.id}`,
      pass: exists && size > 0,
      detail: exists ? (size > 0 ? `${(size / 1024).toFixed(0)}KB` : '0 bytes — corrupted') : 'missing',
    });
  }

  // 2. Extracted copy exists
  for (const frame of ALL_FRAMES) {
    const p = path.join(OUTPUT_DIR, `${frame.id}.copy.json`);
    checks.push({
      name: `Copy extract: ${frame.id}`,
      pass: fs.existsSync(p),
      detail: fs.existsSync(p) ? 'present' : 'missing',
    });
  }

  // 3. Annotations file
  const annotationsExist = fs.existsSync(ANNOTATIONS_PATH);
  checks.push({
    name: 'Annotations file',
    pass: annotationsExist,
    detail: annotationsExist ? 'present' : 'missing — deck will generate without annotations',
  });

  if (annotationsExist) {
    const annotations: FrameAnnotation[] = JSON.parse(fs.readFileSync(ANNOTATIONS_PATH, 'utf-8'));

    // 4. All annotations have required fields
    for (const a of annotations) {
      checks.push({
        name: `Annotation fields: ${a.frameId}`,
        pass: !!(a.purposeAndIntent?.summary && a.purposeAndIntent?.userAction),
        detail: a.purposeAndIntent?.summary ? 'complete' : 'missing purposeAndIntent',
      });
    }

    // 5. No drafted without flag
    if (!ALLOW_DRAFTED) {
      const drafted = annotations.filter(a => a.status === 'drafted');
      checks.push({
        name: 'Annotation status',
        pass: drafted.length === 0,
        detail: drafted.length === 0 ? 'all reviewed/final' : `${drafted.length} still drafted — use --allow-drafted to override`,
      });
    }
  }

  // 6. Source materials
  checks.push({
    name: 'Source materials directory',
    pass: fs.existsSync(SOURCE_DIR),
    detail: fs.existsSync(SOURCE_DIR) ? 'present' : 'missing',
  });

  // 7. Design deck
  const designExists = fs.existsSync(DESIGN_DIR) && fs.readdirSync(DESIGN_DIR).length > 0;
  checks.push({
    name: 'Design deck',
    pass: true, // warning only, not blocking
    detail: designExists ? 'present' : 'missing — using defaults',
  });

  return checks;
}

function main() {
  console.log('\n🔍 Pre-flight checks\n');

  const checks = run();
  const failed = checks.filter(c => !c.pass);
  const warnings = checks.filter(c => c.name === 'Design deck' && !c.detail.includes('present'));

  for (const c of checks) {
    const icon = c.pass ? '✓' : '✗';
    console.log(`  ${icon} ${c.name}: ${c.detail}`);
  }

  if (warnings.length > 0) {
    console.log(`\n⚠ ${warnings.length} warning(s)`);
  }

  if (failed.length > 0) {
    console.log(`\n✗ ${failed.length} check(s) failed. Fix before assembly.\n`);
    process.exit(1);
  }

  console.log(`\n✓ All ${checks.length} checks passed.\n`);
}

main();
