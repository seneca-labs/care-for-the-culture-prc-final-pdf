# care-for-culture-prc

PRC submission deck builder for Care for the Culture kiosk experience.

## Quick Start

```bash
npm install
npx playwright install chromium

# Full pipeline (requires kiosk running at localhost:3000)
npm run all

# Single frame capture
npm run single -- --frame=frame-6

# Build deck only (uses existing screenshots)
npm run build
```

## Pipeline

1. **Capture** (`npm run capture`) — Playwright screenshots + DOM copy extraction
2. **Validate** (`npm run annotate`) — Pre-flight checks on screenshots and annotations
3. **Build** (`npm run build`) — HTML deck assembly + PDF export

## Annotations

Edit `src/annotations/annotations.json`. Each frame needs:
- `purposeAndIntent` (required)
- `legalAndComplianceLanguage` (data-collecting frames)
- `dataCalculation` + `dataVisualization` (data-displaying frames)
- `variantCopy` (frames 8, 9, 10)

Status flow: `drafted` → `reviewed` → `final`

Build blocks on `drafted` status unless `--allow-drafted` is passed.

## Source Materials

Place supporting documents in `source-materials/`:
- Call transcripts, recap emails, spec versions
- Agent drafts annotations FROM these — never invents reasoning

## Design

Place brand deck in `design/`. CSS variables auto-extracted for deck styling.

## Output

- `output/deck-v{N}.html` — Browser-viewable deck
- `output/PRC-Submission-v{N}.pdf` — Print-ready PDF
- `output/screenshots/` — All frame captures + extracted copy JSON
