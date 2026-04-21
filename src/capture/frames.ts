// Frame definitions for PRC submission screenshot capture

export interface FrameDef {
  id: string;
  title: string;
  variant?: 'connected' | 'new-skipped';
  settleOverride?: number; // additional ms beyond default 2500
  setup: CaptureSetup;
  validation?: ValidationCheck[];
}

export interface CaptureSetup {
  screen: string;
  prepAnswer?: 'connected' | 'new' | 'skipped';
  zipCode?: string;
  cardIndex?: number;
  dragPercent?: number;
  sliderYear?: number;
  boroughSentenceIndex?: number;
}

export interface ValidationCheck {
  selector: string;
  condition: 'visible' | 'text-contains' | 'not-disabled';
  value?: string;
}

// Default settle time after navigation
export const SETTLE_TIME_MS = 2500;

// --------------------------------------------------------------------------
// Single-variant frames
// --------------------------------------------------------------------------

const singleFrames: FrameDef[] = [
  {
    id: 'frame-1',
    title: 'Splash / Home',
    setup: { screen: 'K-01' },
  },
  {
    id: 'frame-2',
    title: 'Onboarding',
    setup: { screen: 'K-02a' },
  },
  {
    id: 'frame-3',
    title: 'Photo Capture',
    setup: { screen: 'K-05' },
  },
  {
    id: 'frame-4',
    title: 'Photo Review',
    setup: { screen: 'K-05b' },
  },
  {
    id: 'frame-5',
    title: 'Zip Code Entry',
    setup: { screen: 'K-06', zipCode: '11203' },
  },
  {
    id: 'frame-6',
    title: 'PrEP Question',
    setup: { screen: 'K-07a' },
  },
  {
    id: 'frame-7',
    title: 'Data Intro',
    setup: { screen: 'K-07', zipCode: '11203', prepAnswer: 'connected' },
    // Step 0 of DataMoment
  },

  // Frame 11 cards
  {
    id: 'frame-11-card-1',
    title: 'Neighborhood Overall',
    setup: { screen: 'K-07', zipCode: '11203', prepAnswer: 'connected', cardIndex: 0 },
    validation: [{ selector: '[data-testid="stat-value"]', condition: 'visible' }],
  },
  {
    id: 'frame-11-card-2',
    title: 'New Diagnoses by Race',
    setup: { screen: 'K-07', zipCode: '11203', prepAnswer: 'connected', cardIndex: 1 },
  },
  {
    id: 'frame-11-card-3',
    title: 'PrEP Coverage by Age',
    setup: { screen: 'K-07', zipCode: '11203', prepAnswer: 'connected', cardIndex: 2 },
  },
  {
    id: 'frame-11-card-4',
    title: 'PrEP Coverage by Gender',
    setup: { screen: 'K-07', zipCode: '11203', prepAnswer: 'connected', cardIndex: 3 },
  },
  {
    id: 'frame-11-card-5-initial',
    title: 'Spread Awareness (untouched)',
    setup: { screen: 'K-07', zipCode: '11203', prepAnswer: 'connected', cardIndex: 4 },
  },
  {
    id: 'frame-11-card-5-mid',
    title: 'Spread Awareness (dragging)',
    settleOverride: 1500,
    setup: { screen: 'K-07', zipCode: '11203', prepAnswer: 'connected', cardIndex: 4, dragPercent: 40 },
  },
  {
    id: 'frame-11-card-5-complete',
    title: 'Spread Awareness (complete)',
    settleOverride: 2000,
    setup: { screen: 'K-07', zipCode: '11203', prepAnswer: 'connected', cardIndex: 4, dragPercent: 80 },
  },

  // Post-data frames
  {
    id: 'frame-12',
    title: 'Card Generation',
    settleOverride: 1000,
    setup: { screen: 'K-11' },
  },
  {
    id: 'frame-13',
    title: 'Name Entry',
    setup: { screen: 'K-12' },
  },
  {
    id: 'frame-14',
    title: 'Feed Opt-In',
    setup: { screen: 'K-13' },
  },
  {
    id: 'frame-15',
    title: 'Phone Number',
    setup: { screen: 'K-14' },
  },
  {
    id: 'frame-16',
    title: 'Done / QR',
    setup: { screen: 'K-15' },
  },
];

// --------------------------------------------------------------------------
// Variant frames (connected + new-skipped)
// --------------------------------------------------------------------------

function makeVariants(
  baseId: string,
  title: string,
  baseSetup: Omit<CaptureSetup, 'prepAnswer'>,
  settleOverride?: number,
): FrameDef[] {
  return [
    {
      id: `${baseId}-connected`,
      title: `${title} (connected)`,
      variant: 'connected',
      settleOverride,
      setup: { ...baseSetup, prepAnswer: 'connected' },
    },
    {
      id: `${baseId}-new-skipped`,
      title: `${title} (new/skipped)`,
      variant: 'new-skipped',
      settleOverride,
      setup: { ...baseSetup, prepAnswer: 'new' },
    },
  ];
}

const variantFrames: FrameDef[] = [
  ...makeVariants('frame-8', 'National Timeline', { screen: 'K-07', zipCode: '11203', sliderYear: 2023 }, 2000),
  ...makeVariants('frame-9', 'Borough', { screen: 'K-07', zipCode: '11203', boroughSentenceIndex: 0 }),
  ...makeVariants('frame-10', 'Impact Intro', { screen: 'K-07', zipCode: '11203' }),
];

// --------------------------------------------------------------------------
// Full inventory
// --------------------------------------------------------------------------

export const ALL_FRAMES: FrameDef[] = [...singleFrames, ...variantFrames];

export const TOTAL_SCREENSHOTS = ALL_FRAMES.length; // 24
