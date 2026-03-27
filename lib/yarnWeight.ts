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
  tapestryGaugeHint: string;
  c2cGaugeHint: string;
  defaultTapestryHook: string; // label string matching one of hookOptions
  defaultC2cHook: string;
  hookOptions: HookOption[];
  /** Gauge for physical size calculations */
  tapestryStitchesPerInch: number;
  tapestryRowsPerInch: number;
  c2cBlocksPerInch: number;
}

export const YARN_WEIGHT_CONFIGS: YarnWeightConfig[] = [
  {
    id: 'fingering',
    label: 'Fingering / Lace (#1)',
    tapestryYardsPerStitch: 0.2,
    c2cYardsPerBlock: 0.35,
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 8 sts / 9 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~2 blocks per inch.',
    defaultTapestryHook: '2.25mm (B-1)',
    defaultC2cHook: '2.5mm (C-2)',
    hookOptions: [
      { mm: 1.75, label: '1.75mm (Steel #4)' },
      { mm: 2.0,  label: '2.0mm (Steel #4)' },
      { mm: 2.25, label: '2.25mm (B-1)' },
      { mm: 2.5,  label: '2.5mm (C-2)' },
      { mm: 3.0,  label: '3.0mm (D-3)' },
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
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 6 sts / 7 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~1.5 blocks per inch.',
    defaultTapestryHook: '2.75mm (C-2)',
    defaultC2cHook: '3.25mm (D-3)',
    hookOptions: [
      { mm: 2.5,  label: '2.5mm (C-2)' },
      { mm: 2.75, label: '2.75mm (C-2)' },
      { mm: 3.0,  label: '3.0mm (D-3)' },
      { mm: 3.25, label: '3.25mm (D-3)' },
      { mm: 3.5,  label: '3.5mm (E-4)' },
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
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 5 sts / 6 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~1.2 blocks per inch.',
    defaultTapestryHook: '3.5mm (E-4)',
    defaultC2cHook: '4.0mm (G-6)',
    hookOptions: [
      { mm: 3.25, label: '3.25mm (D-3)' },
      { mm: 3.5,  label: '3.5mm (E-4)' },
      { mm: 3.75, label: '3.75mm (F-5)' },
      { mm: 4.0,  label: '4.0mm (G-6)' },
      { mm: 4.5,  label: '4.5mm (#7)' },
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
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 4 sts / 5 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~1 block per inch.',
    defaultTapestryHook: '4.5mm (#7)',
    defaultC2cHook: '5.5mm (I-9)',
    hookOptions: [
      { mm: 4.0, label: '4.0mm (G-6)' },
      { mm: 4.5, label: '4.5mm (#7)' },
      { mm: 5.0, label: '5.0mm (H-8)' },
      { mm: 5.5, label: '5.5mm (I-9)' },
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
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 3 sts / 3.5 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~0.75 blocks per inch.',
    defaultTapestryHook: '6.0mm (J-10)',
    defaultC2cHook: '6.5mm (K-10.5)',
    hookOptions: [
      { mm: 5.5, label: '5.5mm (I-9)' },
      { mm: 6.0, label: '6.0mm (J-10)' },
      { mm: 6.5, label: '6.5mm (K-10.5)' },
      { mm: 7.0, label: '7.0mm' },
      { mm: 8.0, label: '8.0mm (L-11)' },
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
    tapestryGaugeHint: 'Row-by-row, carrying yarn behind. Gauge: 2 sts / 2.5 rows per inch.',
    c2cGaugeHint: 'Diagonal blocks from corner to corner. Gauge: ~0.5 blocks per inch.',
    defaultTapestryHook: '9.0mm (M/N-13)',
    defaultC2cHook: '10.0mm (N/P-15)',
    hookOptions: [
      { mm: 8.0,  label: '8.0mm (L-11)' },
      { mm: 9.0,  label: '9.0mm (M/N-13)' },
      { mm: 10.0, label: '10.0mm (N/P-15)' },
      { mm: 12.0, label: '12.0mm (P/Q)' },
      { mm: 15.0, label: '15.0mm (P/Q-16)' },
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
  return stitchType === 'c2c' ? config.defaultC2cHook : config.defaultTapestryHook;
}
