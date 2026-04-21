# care-for-culture-prc — PRC Submission Deck Builder

## Context

Gilead's PRC (Promotional Review Committee) review requires a frame-by-frame annotated submission deck showing every screen the end user will see. Per Nikki Crump's 4/14 recap email, the submission must include frame-by-frame copy, part numbers (placeholders for Majority to fill in), and annotations explaining sourcing and intent. This spec defines a reproducible pipeline that:

1. Captures portrait-mode (mobile kiosk) screenshots of every frame after animations complete
2. Generates an HTML deck with each frame rendered as a single landscape page — screenshot on the left, annotations on the right
3. Publishes the deck to GitHub under `seneca-labs/care-for-culture-prc`
4. Exports the deck as a PDF for PRC submission

The deliverable is a polished document that PRC reviewers read sequentially and redline. Aesthetic treatment follows a design deck the user places in `/design/`.

## Repository Structure

Create `github.com/seneca-labs/care-for-culture-prc`:

```
care-for-culture-prc/
├── README.md
├── package.json
├── playwright.config.ts
├── src/
│   ├── capture/
│   │   ├── index.ts              # Screenshot orchestrator
│   │   ├── frames.ts             # Frame definitions + variants
│   │   ├── state-helpers.ts      # Programmatic state setters
│   │   └── animation-wait.ts     # Post-animation detection
│   ├── annotations/
│   │   ├── index.ts
│   │   ├── annotations.json      # Frame annotation data
│   │   └── schema.ts
│   ├── assemble/
│   │   ├── index.ts              # HTML deck builder
│   │   ├── templates/
│   │   │   ├── cover.html
│   │   │   ├── toc.html
│   │   │   ├── frame-page.html   # Single-frame layout
│   │   │   └── appendix.html
│   │   ├── styles/
│   │   │   └── deck.css          # Deck styling (overridden by design deck)
│   │   └── pdf-export.ts         # HTML → PDF via Playwright
│   └── validate/
│       └── preflight.ts
├── source-materials/             # Source docs for annotations
├── design/                       # User-provided design deck
├── output/
│   ├── screenshots/
│   ├── deck-v{N}.html
│   └── PRC-Submission-v{N}.pdf
└── .github/
    └── workflows/
        ├── regenerate.yml        # Rebuild on push
        └── publish.yml           # Publish HTML to GitHub Pages
```

## Part 1: Screenshot Capture

### Prerequisites

- Kiosk web app running at a known URL (`http://localhost:3000` or as specified)
- Current build state: persistent map at full opacity above cards, five-card carousel beneath (Neighborhood Overall, Race, Age, Gender, Spread Awareness), segmented 5-dot progress indicator, context-aware prompt text above map
- Frames addressable via programmatic state-setting helpers exposed on window (see Capture Orchestration below)

### Frame Inventory

Every frame is captured in portrait orientation matching kiosk display. Each sub-slide of the Frame 11 carousel gets its own screenshot.

**Single-variant frames (1 screenshot each):**

| Frame ID | Title | Capture State |
|----------|-------|---------------|
| frame-1 | Splash / Home | Attract loop, representative moment |
| frame-2 | Onboarding | Full screen with ToU/Privacy links visible |
| frame-3 | Photo Capture | Test avatar in frame, not real face |
| frame-4 | Photo Review | Test avatar, "looks good" visible |
| frame-5 | Zip Code Entry | Test zip 11203 entered |
| frame-6 | PrEP Question | All two options + skip visible |
| frame-7 | Data Intro | Full intro copy + key visible |
| frame-11-card-1 | Neighborhood Overall | Map at full opacity above, progress 1/5, swipe prompt above map |
| frame-11-card-2 | Race Diagnoses | Map above, progress 2/5, swipe prompt |
| frame-11-card-3 | Age PrEP | Map above, progress 3/5, swipe prompt |
| frame-11-card-4 | Gender PrEP | Map above, progress 4/5, swipe prompt |
| frame-11-card-5-initial | Spread Awareness (untouched) | Progress 5/5, drag prompt visible, button disabled |
| frame-11-card-5-mid | Spread Awareness (dragging) | Counter showing mid-value, dots partially transitioned |
| frame-11-card-5-complete | Spread Awareness (complete) | Final counter, button enabled with pulse |
| frame-12 | Card Generation | "done" state, not mid-generation |
| frame-13 | Name Entry | Empty state with placeholders |
| frame-14 | Feed Opt-In | Both options visible with disclosure |
| frame-15 | Phone Number | Empty input + TCPA language visible |
| frame-16 | Done / QR | Full final screen |

**Variant frames (2 screenshots each — connected, new-skipped):**

| Frame ID | Title | Capture State |
|----------|-------|---------------|
| frame-8 | National Timeline | 2023 end-state, affirming sentence fully rendered |
| frame-9 | Borough | Rotation position 1 (first animated sentence) |
| frame-10 | Impact Intro | Full intro copy for each variant |

**Total: 24 screenshots.**

### Test Data Consistency

All screenshots use:
- Zip code: **11203** (Kings County, NY)
- Name: "Test User" where required
- Instagram: blank
- PrEP answer: "connected" for single-variant frames; both variants where specified

Document in annotation file so PRC reviewers can reproduce.

### Post-Animation Capture Strategy

Every screenshot is captured AFTER animations settle. Strategy combines two approaches:

**Primary mechanism: settle-time waits.** After navigating to a frame and setting state, wait 2500ms before capturing. This is a deliberate over-correction — most animations complete within 800–1500ms, so 2500ms is a comfortable buffer.

```typescript
const SETTLE_TIME_MS = 2500;

async function captureFrame(page: Page, frameId: string) {
  await navigateToFrame(page, frameId);
  await page.waitForTimeout(SETTLE_TIME_MS);
  await validateDOMState(page, frameId);
  await page.screenshot({
    path: `output/screenshots/${frameId}.png`,
    fullPage: false  // viewport-only, not full scroll
  });
}
```

**Per-frame wait overrides** for longer animations:

| Frame | Additional Wait | Reason |
|-------|-----------------|--------|
| frame-8 (both variants) | +2000ms | Slider animates 2012 → 2023 |
| frame-11-card-5-mid | +1500ms | Dot color transitions during drag |
| frame-11-card-5-complete | +2000ms | Button pulse + counter finalization |
| frame-12 | +1000ms | Card generation "creating your card..." |

**Secondary: DOM-state validation** after wait completes:

| Frame | Validation |
|-------|------------|
| frame-8 | Affirming sentence element present, computed opacity = 1 |
| frame-11-card-1 | First chip shows "542", second shows "1,225" |
| frame-11-card-2 | Three chips visible, rates 39/36/7 |
| frame-11-card-3 | Three chips visible, ordered 1384/312/118 |
| frame-11-card-4 | Two chips visible, 1021 above 62 |
| frame-11-card-5-initial | Counter reads 0, button is disabled |
| frame-11-card-5-mid | Counter reads mid-range value (50–150) |
| frame-11-card-5-complete | Counter reads final value, button is NOT disabled |
| frame-12 | Heading reads "done", not "creating your card..." |

If validation fails, log the failure and skip the capture. Preflight (Part 6) will catch missing frames and block the build.

### Viewport & Resolution

- Viewport: **1080×1920 portrait** (confirm with Ceej against actual kiosk hardware)
- Device scale factor: 2 (high-DPI output)
- Wait for network idle before capture
- Disable cursor rendering in screenshots
- Full-viewport capture for Frame 11 frames (map above + card + progress indicator + prompt text)

### State-Setting Helpers

The kiosk must expose deterministic state setters on `window`, gated behind `?captureMode=true`:

```typescript
window.__captureMode = {
  navigateTo: (frameId: string) => Promise<void>,
  setPrepAnswer: (answer: "connected" | "new-skipped") => void,
  setZipCode: (zip: string) => void,
  setCardIndex: (index: number) => void,
  simulateDragProgress: (percent: number) => Promise<void>,
  setFrame8SliderPosition: (year: number) => void,
  setFrame9BoroughSentenceIndex: (index: number) => void,
  getAnimationsComplete: () => boolean,
};
```

If the kiosk uses framer-motion or similar, `getAnimationsComplete` returns true once all motion values settle.

### Capture Orchestration

Sequential Playwright test suite in `src/capture/index.ts`. Tests run one at a time (not parallel) because some frames depend on state from prior frames. Each test:

1. Opens fresh page with `?captureMode=true`
2. Seeds required state via helpers
3. Navigates to target frame
4. Applies frame-specific setup (drag simulation, variant selection, slider forcing)
5. Waits settle time plus any per-frame override
6. Runs DOM-state validation
7. Captures viewport to `output/screenshots/{frameId}.png`

## Part 2: Copy Extraction

Rather than manually populating `copyOnScreen` arrays in annotations, **the pipeline extracts copy directly from the DOM at capture time**. This eliminates a class of errors where annotation text diverges from actual kiosk text after copy edits.

During capture, after DOM validation completes but before taking the screenshot:

```typescript
const extractedCopy = await page.evaluate(() => {
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
    if (text && text.length > 0) copy.push(text);
  }
  return copy;
});
```

Save extracted copy alongside the screenshot as `output/screenshots/{frameId}.copy.json`. The deck assembly step reads this file to populate the "Copy on Frame" section.

This means annotators don't need to transcribe copy manually — it comes directly from the source of truth (the kiosk DOM).

## Part 3: Annotations

### Annotation Schema

```typescript
export type AnnotationStatus = "drafted" | "reviewed" | "final";

export interface FrameAnnotation {
  frameId: string;
  frameNumber: number;
  variantId?: string;                 // "connected" | "new-skipped"
  title: string;                      // Human-readable frame name
  screenshotPath: string;
  extractedCopyPath: string;          // Path to .copy.json from Part 2

  partNumber: string;                 // Placeholder, Majority fills

  purposeAndIntent: {
    summary: string;                  // Why this frame exists in the flow
    userAction: string;               // What the user does here
  };

  legalAndComplianceLanguage?: {      // Only for frames with legal copy
    copyExcerpt: string;              // The specific text that's compliance-driven
    purpose: string;                  // Why it's worded this way
    stakeholderGuidance: string[];    // Which stakeholder calls shaped it
    concernsAddressed: string[];      // Specific legal/compliance concerns
    basis: string;                    // "TCPA", "HIV confidentiality statutes", etc.
  };

  variantCopy?: {                     // Only for frames with connected/new-skipped split
    connected: string;
    newOrSkipped: string;
    rationale: string;                // Why the copy differs
  };

  dataCalculation?: {                 // Only for frames that display data
    source: string;                   // "aidsvu 2023"
    fieldsUsed: string[];
    calculationMethod: string;
    aiOrAlgorithmicInference: "none" | string;
  };

  dataVisualization?: {               // Only for frames with visual data displays
    description: string;              // "Stat chip treatment, uniform dimensions"
    rationale: string;                // Why this visual choice was made
  };

  additionalCopy?: string[];          // Any copy on frame not covered above

  status: AnnotationStatus;
}
```

### Authorship Constraint

CRITICAL: Claude Code drafts annotation content from source materials but does NOT finalize. Workflow:

1. Agent generates first-pass annotations based on `source-materials/`
2. Each annotation carries `status: "drafted"`
3. Assembly step FAILS if any annotation remains `"drafted"` without explicit `--allow-drafted` flag
4. User reviews, flips status to `"reviewed"` or `"final"`

The agent must not:
- Invent stakeholder quotes or attributions
- Make compliance claims without source citation
- Mark annotations "final" autonomously
- Skip the status field

### Source Materials

`/source-materials/` contains:

- `r2-regroup-transcript.md` (4/10 call)
- `legal-review-transcript.md` (4/14 call with Jared + Angelique)
- `nikki-recap-email.md` (4/14 summary of decisions)
- `spec-v2-copy.md`
- `spec-v3-typography-forward.md`
- `spec-v4-persistent-map.md`
- `final-build-update-spec.md`
- `stakeholder-attribution.md` (who said what, when, in what role)
- `executive-summary.md`
- `data-architecture.md`

Without these, the agent cannot ground reasoning in actual stakeholder guidance.

### Gold-Standard Annotation Examples

**Frame 6 (PrEP Question):**

```json
{
  "frameId": "frame-6",
  "title": "PrEP Question",
  "purposeAndIntent": {
    "summary": "Asks the user about their relationship to prep using de-identified language to shape the narrative experience on subsequent frames.",
    "userAction": "Selects one of two pathways or skips the question."
  },
  "legalAndComplianceLanguage": {
    "copyExcerpt": "does prep show up in your world? / i'm on prep or know someone who is / not on prep or new to prep / skip",
    "purpose": "Two-pathway question structure collapses an earlier four-option design to de-identify users as patients. Phrasing includes 'know someone who is' so selecting the option does not imply the user personally is on prep. Skip option preserves user autonomy without penalty.",
    "stakeholderGuidance": [
      "Angelique Bell (Gilead Compliance, 4/14 call): flagged that the original four-option prep question with 'I'm on it' created patient self-identification risk under HIV confidentiality statutes and recommended collapsing to ambiguous phrasing that does not identify the user as a patient.",
      "Nikki Crump (Majority, 4/14 recap email): directed simplification to two pathways — 'I am on PrEP or know someone who is' / 'I am not on PrEP or not aware of PrEP' — with flexibility on final wording."
    ],
    "concernsAddressed": [
      "State HIV confidentiality statutes (jurisdiction-dependent)",
      "Patient status self-identification risk",
      "User autonomy via skip option"
    ],
    "basis": "State HIV confidentiality statutes (jurisdiction-dependent). HIPAA not triggered per Jared's 4/14 assessment (Gilead not a covered entity for this event). TCPA not applicable to this screen."
  },
  "status": "final"
}
```

**Frame 11-card-2 (Race Diagnoses):**

```json
{
  "frameId": "frame-11-card-2",
  "title": "New Diagnoses by Race — Kings County",
  "purposeAndIntent": {
    "summary": "Displays HIV diagnosis rates by race for the user's county, framing the awareness gap as a community-level observation.",
    "userAction": "Reads the breakdown. Swipes to next card."
  },
  "dataCalculation": {
    "source": "aidsvu 2023",
    "fieldsUsed": ["new HIV diagnoses per 100,000 by race, county-level"],
    "calculationMethod": "Direct display of aidsvu-published rates. No derivation, modeling, or inference.",
    "aiOrAlgorithmicInference": "none"
  },
  "dataVisualization": {
    "description": "Three rust-colored stat chips with uniform dimensions regardless of underlying data magnitude. Chips stacked vertically with labels beside. Numbers displayed inside chips at bold weight. Persistent drag map rendered above the card at full opacity throughout the carousel.",
    "rationale": "Uniform chip dimensions eliminate perceptual distortion risk from size-based visual encoding. Prior iterations using bar fills normalized within-card and overstated relative proportions, creating potential for misreading magnitude. Chip treatment displays numbers as data points without any visual scaling mechanism. Data ordering (highest to lowest) is the only comparative visual mechanism; chip dimensions do not encode magnitude."
  },
  "status": "drafted"
}
```

### Annotation Sections By Frame Type

Not every section applies to every frame. Include only relevant sections:

- **Data-collecting frames** (5, 6, 13, 15): `legalAndComplianceLanguage` required
- **Data-displaying frames** (8, 9, 10, 11-cards): `dataCalculation` + `dataVisualization` required
- **Variant frames** (8, 9, 10): `variantCopy` required
- **Nav/confirmation frames** (3, 4, 7, 12, 16): `purposeAndIntent` only

Empty sections should not render in the output deck.

## Part 4: HTML Deck Assembly

### Page Layout

Each frame is a single landscape page. Layout: **40% screenshot (left), 60% annotations (right)**. This gives the portrait kiosk image breathing room while leaving substantial space for text.

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  Frame 6 — PrEP Question                                              │
│  Part Number: _____________                                           │
│                                                                       │
│  ┌───────────────┐    Purpose & Intent                                │
│  │               │    Asks the user about their relationship to      │
│  │               │    prep using de-identified language...            │
│  │               │                                                    │
│  │  Screenshot   │    Legal & Compliance Language                     │
│  │  (portrait)   │    Copy excerpt: "does prep show up in your..."    │
│  │               │    Purpose: Two-pathway question structure...      │
│  │               │    Stakeholder guidance:                           │
│  │               │      • Angelique Bell (Gilead Compliance, 4/14)... │
│  │               │      • Nikki Crump (Majority, 4/14 recap email)... │
│  │               │    Concerns addressed:                              │
│  │               │      • State HIV confidentiality statutes          │
│  │               │      • Patient status self-identification risk     │
│  │               │    Basis: State HIV confidentiality statutes...    │
│  │               │                                                    │
│  └───────────────┘    Copy on Frame                                   │
│                       (auto-extracted from kiosk DOM)                 │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Page Templates

Section headings on the right use **clear, reader-friendly subtitles** rather than schema field names. Mapping:

| Schema field | Display heading |
|--------------|-----------------|
| `purposeAndIntent` | "Purpose & Intent" |
| `legalAndComplianceLanguage` | "Legal & Compliance Language" |
| `variantCopy` | "Customized Copy by PrEP Answer" |
| `dataCalculation` | "How the Data Is Calculated" |
| `dataVisualization` | "How the Data Is Visualized" |
| `additionalCopy` | "Other Copy on Frame" |
| (DOM-extracted) | "Copy on Frame (Verbatim)" |

Within each section, sub-labels are equally clear:
- "Copy excerpt" → "Exact copy on screen"
- "Purpose" → "Why this language is here"
- "Stakeholder guidance" → "Stakeholder guidance that shaped this"
- "Concerns addressed" → "Concerns this addresses"
- "Basis" → "Legal basis"
- "Rationale" (under viz) → "Why this visual treatment"
- "Method" (under calc) → "How we calculate it"
- "Algorithmic inference" → "Any AI or algorithmic inference"

### Deck Structure

1. **Cover page** (landscape)
   - Title: "Care for the Culture — Kiosk Experience"
   - Subtitle: "PRC Submission — Freddy Events, NYC + LA"
   - Submission date (auto from build)
   - Version number (auto-incremented)
   - Submitting agency: Majority
   - Production: Vega Studios + Seneca Labs
   - "Part Number: _______________" (highlighted placeholder)

2. **Table of Contents** (landscape)
   - Auto-generated from frame inventory
   - Lists every frame and variant with page numbers

3. **Executive Summary** (1 landscape page)
   - From `source-materials/executive-summary.md`

4. **User Journey Overview** (1-2 landscape pages)
   - Sequential flowchart of frames
   - Variant branch indicators (prep answer pathways, skip actions)
   - Frame 11 sub-sequence visualized with persistent map element

5. **Frame-by-Frame Section** (one landscape page per frame + variant)
   - Layout per above

6. **Supporting Documentation Appendix** (landscape)
   - Data architecture summary
   - Consent flow summary
   - TCPA / 10DLC compliance statement
   - aidsvu data citation + methodology note
   - Risk mitigation framework
   - Stakeholder attribution reference
   - Relevant transcript excerpts (not full transcripts) with key quotes that shaped decisions

### HTML Implementation

Generate static HTML with embedded CSS. Use print-specific styles (`@page { size: landscape }`, `page-break-before: always` between frames) so the HTML prints/exports cleanly to PDF.

Key CSS requirements:

```css
@page {
  size: 11in 8.5in; /* landscape letter */
  margin: 0.5in;
}

.frame-page {
  page-break-before: always;
  display: grid;
  grid-template-columns: 40% 60%;
  gap: 0.5in;
}

.frame-screenshot img {
  width: 100%;
  height: auto;
  max-height: 7in;  /* prevent oversized screenshots */
  object-fit: contain;
}

.frame-annotations {
  font-family: /* from design deck or default */;
  font-size: 11pt;
  line-height: 1.4;
}

.part-number-field {
  background: yellow;
  border-bottom: 1px solid black;
  display: inline-block;
  min-width: 2in;
  padding: 2px 8px;
}
```

### Part Number Placeholder Treatment

Every frame page has a "Part Number: _______________" field:
- Yellow highlight background
- Underlined fill-in line
- Inline comment via HTML attribute (picked up as annotation in Word if imported): `data-comment="Majority to provide part number before final submission"`

### PDF Export

After HTML generation, export to PDF using **Playwright's `page.pdf()`** method:

```typescript
await page.pdf({
  path: `output/PRC-Submission-v${version}.pdf`,
  format: 'Letter',
  landscape: true,
  printBackground: true,
  margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
});
```

Playwright is already a dependency for screenshot capture, so no new tooling is required. Output matches the browser rendering exactly.

Both HTML and PDF ship as deliverables:
- `output/deck-v{N}.html` — published to GitHub Pages for browser viewing
- `output/PRC-Submission-v{N}.pdf` — for PRC submission and redlining

## Part 5: Aesthetic Treatment

User places design deck in `/design/`. Claude Code extracts:
- Color palette
- Typography (family, sizes, weights)
- Page layout conventions
- Header/footer styling
- Callout box treatments

Apply via CSS variables in `src/assemble/styles/deck.css`:

```css
:root {
  --color-primary: /* from design deck */;
  --color-accent-green: /* brand green */;
  --color-accent-rust: /* hiv color */;
  --font-body: /* from design deck */;
  --font-heading: /* from design deck */;
  /* etc. */
}
```

If design deck is missing or ambiguous, preflight flags it and uses safe defaults:
- Typography: Inter or system-ui, 11pt body, 16pt headings
- Color: Subtle brand green accents on headings, otherwise neutral
- Layout: 0.5in margins, landscape letter

Do not invent aesthetic treatments beyond the design deck or defaults.

## Part 6: GitHub Publishing

The HTML deck is published to GitHub Pages automatically via `.github/workflows/publish.yml`:

```yaml
name: Publish Deck

on:
  push:
    branches: [main]
    paths: ['output/deck-*.html', 'output/screenshots/**']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./output
```

Deck is viewable at `https://seneca-labs.github.io/care-for-culture-prc/deck-v{N}.html`.

PDF is attached to GitHub Releases for versioned distribution.

## Part 7: Regeneration Workflow

### Local

```bash
npm run capture      # Fresh screenshots + copy extraction
npm run annotate     # Validate annotation completeness
npm run build        # Generate HTML deck + PDF
npm run all          # Full pipeline
npm run single -- --frame frame-6  # Single-frame dev loop
```

### CI (`.github/workflows/regenerate.yml`)

On push to main or manual trigger:
1. Set up Playwright environment
2. Run full pipeline
3. Commit updated `output/` with version bump
4. Publish HTML to GitHub Pages
5. Attach PDF to a GitHub Release

### Versioning

Output filenames auto-increment: `deck-v1.html`, `deck-v2.html`, `PRC-Submission-v1.pdf`, etc. Version based on highest existing in `output/`.

## Part 8: Pre-Flight Checks

`src/validate/preflight.ts` verifies before assembly:

1. All screenshots referenced in annotations exist on disk
2. No screenshots are 0 bytes or unreadable
3. Screenshot dimensions match configured viewport (1080×1920 portrait)
4. Every annotation entry has required fields populated
5. No annotation remains `"drafted"` (unless `--allow-drafted` flag)
6. Extracted copy (`.copy.json`) exists for every screenshot
7. Test data consistency: zip 11203 visible in extracted copy where expected
8. Frame 11 card screenshots include the persistent map above (not cropped) — validate via pixel check on top portion of image
9. Frame 11-card-5 variants (initial, mid, complete) are visually differentiable — counter values differ, button states differ
10. Source materials directory exists with expected files
11. Design deck present in `/design/` (or defaults logged as warning)

Preflight failures block the build with specific error messages.

## Deliverables

1. GitHub repo: `seneca-labs/care-for-culture-prc`
2. Full pipeline code (capture, extract, annotate, assemble, validate, publish)
3. First-pass annotations drafted from source materials (user reviews before final submission)
4. Generated `output/deck-v1.html` (published to GitHub Pages)
5. Generated `output/PRC-Submission-v1.pdf`
6. README documenting regeneration, annotation updates, source material requirements, design deck placement
7. CI workflows for automated regeneration and publishing
8. Changelog for v1

## Constraints

- All compliance reasoning traceable to specific source material. No invented reasoning.
- Claude Code drafts annotations but never marks them `"final"`.
- Screenshots captured after 2500ms settle time (+ per-frame overrides). No empty or mid-animation captures.
- Part number field is a placeholder. Agent never fills it.
- Pipeline is idempotent: running twice produces identical output (modulo version number and timestamp).
- Frame 11 card screenshots capture full viewport including the persistent map.
- Design deck overrides defaults. Defaults are fallbacks only.
- Repo visibility (public/private) decided by user, flagged during setup.
- Copy on frame is extracted from DOM, not manually transcribed. Annotations never need manual copy updates when kiosk text changes.

## Sequencing Recommendation

- **Day 1:** Scaffold repo, build capture pipeline + copy extraction, verify screenshots work against current kiosk build with all five cards implemented. Do NOT start annotations — verify captures first.
- **Day 2:** User spot-checks 3–5 screenshots visually. Once clean, begin drafting annotations from source materials.
- **Day 3:** User reviews annotations, flips statuses. Run deck assembly. Design review of generated HTML + PDF.
- **Day 4:** Iteration on annotations or visual styling. Regenerate. User reads full deck end-to-end.
- **Day 5 (Tuesday):** PRC submission.
