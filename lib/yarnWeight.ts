import type { YarnWeight, StitchType } from './types';

export interface HookOption {
  mm: number;
  label: string; // e.g. "4.5mm (#7)"
}

export interface YarnWeightConfig {
  id: YarnWeight;
  label: string;              // e.g. "Worsted / Medium (#4)"
  tapestryYardsPerStitch: number;
  c2cYardsPerBlock: number;
  knittingYardsPerStitch: number;
  crossStitchYardsPerStitch: number;
  tapestryGaugeHint: string;
  c2cGaugeHint: string;
  knittingGaugeHint: string;
  crossStitchGaugeHint: string;
  defaultTapestryHook: string; // label string matching one of hookOptions
  defaultC2cHook: string;
  defaultKnittingNeedle: string;
  defaultCrossStitchAida: string;
  hookOptions: HookOption[];
  needleOptions: HookOption[];
  /** Gauge for physical size calculations */
  tapestryStitchesPerInch: number;
  tapestryRowsPerInch: number;
  c2cBlocksPerInch: number;
}

/** Aida fabric count options for cross-stitch (independent of yarn weight). */
export const CROSS_STITCH_AIDA_OPTIONS: HookOption[] = [
  { mm: 11, label: '11-count Aida (coarse)' },
  { mm: 14, label: '14-count Aida (standard)' },
  { mm: 18, label: '18-count Aida (fine)' },
  { mm: 28, label: '28-count Evenweave' },
  { mm: 32, label: '32-count Evenweave (very fine)' },
];

export const YARN_WEIGHT_CONFIGS: YarnWeightConfig[] = [
  {
    id: 'fingering',
    label: 'Fingering / Lace (#1)',
    tapestryYardsPerStitch: 0.2,
    c2cYardsPerBlock: 0.35,
    knittingYardsPerStitch: 0.18,
    crossStitchYardsPerStitch: 0.03,
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 8 sts / 9 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~2 blocks per inch.',
    knittingGaugeHint: 'Stranded colorwork. Gauge: ~9 sts / 10 rows per inch on US 1–2 needles.',
    crossStitchGaugeHint: 'Cross-stitch on 28-count evenweave. Very fine detail, smallest finished size.',
    defaultTapestryHook: '2.25mm (B-1)',
    defaultC2cHook: '2.5mm (C-2)',
    defaultKnittingNeedle: '2.25mm (US 1)',
    defaultCrossStitchAida: '28-count Evenweave',
    hookOptions: [
      { mm: 1.75, label: '1.75mm (Steel #4)' },
      { mm: 2.0,  label: '2.0mm (Steel #4)' },
      { mm: 2.25, label: '2.25mm (B-1)' },
      { mm: 2.5,  label: '2.5mm (C-2)' },
      { mm: 3.0,  label: '3.0mm (D-3)' },
    ],
    needleOptions: [
      { mm: 1.5,  label: '1.5mm (US 000)' },
      { mm: 2.0,  label: '2.0mm (US 0)' },
      { mm: 2.25, label: '2.25mm (US 1)' },
      { mm: 2.75, label: '2.75mm (US 2)' },
      { mm: 3.25, label: '3.25mm (US 3)' },
    ],
    tapestryStitchesPerInch: 8,
    tapestryRowsPerInch: 9,
    c2cBlocksPerInch: 2,
  },
  {
    id: 'sport',
    label: 'Sport / Fine (#2)',
    tapestryYardsPerStitch: 0.3,
    c2cYardsPerBlock: 0.5,
    knittingYardsPerStitch: 0.27,
    crossStitchYardsPerStitch: 0.04,
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 6 sts / 7 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~1.5 blocks per inch.',
    knittingGaugeHint: 'Stranded colorwork. Gauge: ~7 sts / 8 rows per inch on US 3–5 needles.',
    crossStitchGaugeHint: 'Cross-stitch on 18-count Aida. Fine detail, smaller finished size.',
    defaultTapestryHook: '2.75mm (C-2)',
    defaultC2cHook: '3.25mm (D-3)',
    defaultKnittingNeedle: '3.25mm (US 3)',
    defaultCrossStitchAida: '18-count Aida (fine)',
    hookOptions: [
      { mm: 2.5,  label: '2.5mm (C-2)' },
      { mm: 2.75, label: '2.75mm (C-2)' },
      { mm: 3.0,  label: '3.0mm (D-3)' },
      { mm: 3.25, label: '3.25mm (D-3)' },
      { mm: 3.5,  label: '3.5mm (E-4)' },
    ],
    needleOptions: [
      { mm: 3.0,  label: '3.0mm (US 2.5)' },
      { mm: 3.25, label: '3.25mm (US 3)' },
      { mm: 3.5,  label: '3.5mm (US 4)' },
      { mm: 3.75, label: '3.75mm (US 5)' },
    ],
    tapestryStitchesPerInch: 6,
    tapestryRowsPerInch: 7,
    c2cBlocksPerInch: 1.5,
  },
  {
    id: 'dk',
    label: 'DK / Light (#3)',
    tapestryYardsPerStitch: 0.4,
    c2cYardsPerBlock: 0.7,
    knittingYardsPerStitch: 0.36,
    crossStitchYardsPerStitch: 0.04,
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 5 sts / 6 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~1.2 blocks per inch.',
    knittingGaugeHint: 'Stranded colorwork. Gauge: ~6 sts / 7 rows per inch on US 5–7 needles.',
    crossStitchGaugeHint: 'Cross-stitch on 18-count Aida. Good detail, medium-small finished size.',
    defaultTapestryHook: '3.5mm (E-4)',
    defaultC2cHook: '4.0mm (G-6)',
    defaultKnittingNeedle: '3.75mm (US 5)',
    defaultCrossStitchAida: '18-count Aida (fine)',
    hookOptions: [
      { mm: 3.25, label: '3.25mm (D-3)' },
      { mm: 3.5,  label: '3.5mm (E-4)' },
      { mm: 3.75, label: '3.75mm (F-5)' },
      { mm: 4.0,  label: '4.0mm (G-6)' },
      { mm: 4.5,  label: '4.5mm (#7)' },
    ],
    needleOptions: [
      { mm: 3.5,  label: '3.5mm (US 4)' },
      { mm: 3.75, label: '3.75mm (US 5)' },
      { mm: 4.0,  label: '4.0mm (US 6)' },
      { mm: 4.5,  label: '4.5mm (US 7)' },
    ],
    tapestryStitchesPerInch: 5,
    tapestryRowsPerInch: 6,
    c2cBlocksPerInch: 1.2,
  },
  {
    id: 'worsted',
    label: 'Worsted / Medium (#4)',
    tapestryYardsPerStitch: 0.6,
    c2cYardsPerBlock: 1.0,
    knittingYardsPerStitch: 0.54,
    crossStitchYardsPerStitch: 0.05,
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 4 sts / 5 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~1 block per inch.',
    knittingGaugeHint: 'Stranded colorwork. Gauge: ~5 sts / 6 rows per inch on US 7–8 needles.',
    crossStitchGaugeHint: 'Cross-stitch on 14-count Aida. Standard detail, medium finished size.',
    defaultTapestryHook: '4.5mm (#7)',
    defaultC2cHook: '5.5mm (I-9)',
    defaultKnittingNeedle: '5.0mm (US 8)',
    defaultCrossStitchAida: '14-count Aida (standard)',
    hookOptions: [
      { mm: 4.0, label: '4.0mm (G-6)' },
      { mm: 4.5, label: '4.5mm (#7)' },
      { mm: 5.0, label: '5.0mm (H-8)' },
      { mm: 5.5, label: '5.5mm (I-9)' },
    ],
    needleOptions: [
      { mm: 4.5, label: '4.5mm (US 7)' },
      { mm: 5.0, label: '5.0mm (US 8)' },
      { mm: 5.5, label: '5.5mm (US 9)' },
    ],
    tapestryStitchesPerInch: 4,
    tapestryRowsPerInch: 5,
    c2cBlocksPerInch: 1,
  },
  {
    id: 'bulky',
    label: 'Bulky (#5)',
    tapestryYardsPerStitch: 1.0,
    c2cYardsPerBlock: 1.6,
    knittingYardsPerStitch: 0.9,
    crossStitchYardsPerStitch: 0.07,
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 3 sts / 3.5 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~0.75 blocks per inch.',
    knittingGaugeHint: 'Stranded colorwork. Gauge: ~4 sts / 4.5 rows per inch on US 10–10.5 needles.',
    crossStitchGaugeHint: 'Cross-stitch on 11-count Aida. Bold design, larger finished size.',
    defaultTapestryHook: '6.0mm (J-10)',
    defaultC2cHook: '6.5mm (K-10.5)',
    defaultKnittingNeedle: '6.5mm (US 10.5)',
    defaultCrossStitchAida: '11-count Aida (coarse)',
    hookOptions: [
      { mm: 5.5, label: '5.5mm (I-9)' },
      { mm: 6.0, label: '6.0mm (J-10)' },
      { mm: 6.5, label: '6.5mm (K-10.5)' },
      { mm: 7.0, label: '7.0mm' },
      { mm: 8.0, label: '8.0mm (L-11)' },
    ],
    needleOptions: [
      { mm: 6.0, label: '6.0mm (US 10)' },
      { mm: 6.5, label: '6.5mm (US 10.5)' },
      { mm: 8.0, label: '8.0mm (US 11)' },
      { mm: 9.0, label: '9.0mm (US 13)' },
    ],
    tapestryStitchesPerInch: 3,
    tapestryRowsPerInch: 3.5,
    c2cBlocksPerInch: 0.75,
  },
  {
    id: 'super-bulky',
    label: 'Super Bulky (#6)',
    tapestryYardsPerStitch: 1.5,
    c2cYardsPerBlock: 2.4,
    knittingYardsPerStitch: 1.35,
    crossStitchYardsPerStitch: 0.07,
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 2 sts / 2.5 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~0.5 blocks per inch.',
    knittingGaugeHint: 'Stranded colorwork. Gauge: ~2.5 sts / 3 rows per inch on US 13–15 needles.',
    crossStitchGaugeHint: 'Cross-stitch on 11-count Aida. Bold design, largest finished size.',
    defaultTapestryHook: '9.0mm (M/N-13)',
    defaultC2cHook: '10.0mm (N/P-15)',
    defaultKnittingNeedle: '10.0mm (US 15)',
    defaultCrossStitchAida: '11-count Aida (coarse)',
    hookOptions: [
      { mm: 8.0,  label: '8.0mm (L-11)' },
      { mm: 9.0,  label: '9.0mm (M/N-13)' },
      { mm: 10.0, label: '10.0mm (N/P-15)' },
      { mm: 12.0, label: '12.0mm (P/Q)' },
      { mm: 15.0, label: '15.0mm (P/Q-16)' },
    ],
    needleOptions: [
      { mm: 9.0,  label: '9.0mm (US 13)' },
      { mm: 10.0, label: '10.0mm (US 15)' },
      { mm: 12.0, label: '12.0mm (US 17)' },
      { mm: 15.0, label: '15.0mm (US 19)' },
    ],
    tapestryStitchesPerInch: 2,
    tapestryRowsPerInch: 2.5,
    c2cBlocksPerInch: 0.5,
  },
];

export const DEFAULT_YARN_WEIGHT: YarnWeight = 'worsted';

export function getYarnWeightConfig(weight: YarnWeight): YarnWeightConfig {
  return YARN_WEIGHT_CONFIGS.find((c) => c.id === weight) ?? YARN_WEIGHT_CONFIGS[3];
}

export function getDefaultHook(weight: YarnWeight, stitchType: StitchType): string {
  const config = getYarnWeightConfig(weight);
  if (stitchType === 'c2c') return config.defaultC2cHook;
  if (stitchType === 'knitting') return config.defaultKnittingNeedle;
  if (stitchType === 'cross-stitch') return config.defaultCrossStitchAida;
  return config.defaultTapestryHook;
}
