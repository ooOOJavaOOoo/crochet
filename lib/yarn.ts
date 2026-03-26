import convert from 'color-convert';

// delta-e has no @types package; typed inline
type LabColor = { L: number; A: number; B: number };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DeltaE = require('delta-e') as {
  getDeltaE76: (a: LabColor, b: LabColor) => number;
  getDeltaE94: (a: LabColor, b: LabColor) => number;
  getDeltaE00: (a: LabColor, b: LabColor) => number;
};

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface YarnColor {
  id: string;
  name: string;
  brand: string;
  brandId: string;
  hex: string;
  skeinYardage: number;
}

// ---------------------------------------------------------------------------
// Skein yardage lookup
// ---------------------------------------------------------------------------

export const SKEIN_YARDAGES: Record<string, number> = {
  'lion-brand': 1020,
  'red-heart': 364,
  'caron': 315,
  'paintbox': 273,
};

// ---------------------------------------------------------------------------
// Yarn color catalog
// ---------------------------------------------------------------------------

function mkLion(name: string, hex: string): YarnColor {
  return {
    id: `lion-brand-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
    name,
    brand: 'Lion Brand Pound of Love',
    brandId: 'lion-brand',
    hex,
    skeinYardage: 1020,
  };
}

function mkRedHeart(name: string, hex: string): YarnColor {
  return {
    id: `red-heart-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
    name,
    brand: 'Red Heart Super Saver',
    brandId: 'red-heart',
    hex,
    skeinYardage: 364,
  };
}

function mkCaron(name: string, hex: string): YarnColor {
  return {
    id: `caron-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
    name,
    brand: 'Caron Simply Soft',
    brandId: 'caron',
    hex,
    skeinYardage: 315,
  };
}

function mkPaintbox(name: string, hex: string): YarnColor {
  return {
    id: `paintbox-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
    name,
    brand: 'Paintbox Simply DK',
    brandId: 'paintbox',
    hex,
    skeinYardage: 273,
  };
}

export const YARN_COLORS: YarnColor[] = [
  // ── Lion Brand Pound of Love ──────────────────────────────────────────────
  mkLion('Fisherman',     '#F5F0E1'),
  mkLion('White',         '#FFFFFF'),
  mkLion('Black',         '#1A1A1A'),
  mkLion('Butter',        '#FFF3A3'),
  mkLion('Caramel',       '#C4874A'),
  mkLion('Taupe',         '#9C8B7A'),
  mkLion('Grey Marble',   '#9B9B9B'),
  mkLion('Lemon Yellow',  '#FFE84B'),
  mkLion('Tangerine',     '#FF6B2B'),
  mkLion('Hot Pink',      '#FF3D8F'),
  mkLion('Cranberry',     '#9B1A3E'),
  mkLion('True Blue',     '#1E5FA6'),
  mkLion('Navy',          '#1A2D5A'),
  mkLion('Grass Green',   '#4CAF50'),
  mkLion('Forest Green',  '#2D6B3C'),
  mkLion('Purple',        '#6B3FA0'),
  mkLion('Oxford Grey',   '#5C5C5C'),

  // ── Red Heart Super Saver ─────────────────────────────────────────────────
  mkRedHeart('Soft White',     '#F5F1E8'),
  mkRedHeart('Aran',           '#D4C5A9'),
  mkRedHeart('Light Linen',    '#DDD5C0'),
  mkRedHeart('Buff',           '#D4B896'),
  mkRedHeart('Grey Heather',   '#A0A0A0'),
  mkRedHeart('Taupe',          '#8C7B6B'),
  mkRedHeart('Warm Brown',     '#7A4A2A'),
  mkRedHeart('Cafe Latte',     '#A0714F'),
  mkRedHeart('Claret',         '#7A1B3B'),
  mkRedHeart('Burgundy',       '#6B1A2A'),
  mkRedHeart('Amethyst',       '#6B4F8C'),
  mkRedHeart('Teal',           '#1A7A7A'),
  mkRedHeart('Jade',           '#2D7A4A'),
  mkRedHeart('Wine',           '#6B1F35'),
  mkRedHeart('Cherry Red',     '#CC1F2D'),
  mkRedHeart('Royal Blue',     '#1A3FA6'),
  mkRedHeart('Bright Yellow',  '#FFD700'),
  mkRedHeart('Paddy Green',    '#1A8C3A'),
  mkRedHeart('Bright Pink',    '#FF3D8F'),
  mkRedHeart('Petal Pink',     '#FFB3C6'),
  mkRedHeart('Baby Blue',      '#B3D4FF'),
  mkRedHeart('Lavender',       '#C4A8D4'),
  mkRedHeart('Mint',           '#A8D4B8'),

  // ── Caron Simply Soft ─────────────────────────────────────────────────────
  mkCaron('Bone',                  '#F0E8D8'),
  mkCaron('Off White',             '#F8F4EC'),
  mkCaron('Black',                 '#1A1A1A'),
  mkCaron('Grey Heather',          '#9B9B9B'),
  mkCaron('Soft Heather Rose',     '#D4899A'),
  mkCaron('Ocean Heather',         '#7AACBF'),
  mkCaron('Purple Heather',        '#9B7ABF'),
  mkCaron('Dark Sage',             '#5C7A4F'),
  mkCaron('Muted Teal',            '#4A8C8C'),
  mkCaron('Victorian Rose',        '#BF6B7A'),
  mkCaron('Plum Wine',             '#6B2D5C'),
  mkCaron('Persimmon',             '#E06B3A'),
  mkCaron('Autumn Maize',          '#D4A83A'),
  mkCaron('Light Country Peach',   '#F0C4A8'),
  mkCaron('Soft Pink',             '#F5B3C4'),
  mkCaron('Lavender Blue',         '#9BAFD4'),
  mkCaron('Pistachio',             '#A8CC9B'),
  mkCaron('Country Blue',          '#5C8CBF'),

  // ── Paintbox Simply DK ────────────────────────────────────────────────────
  mkPaintbox('Pillar Red',        '#CC1F2D'),
  mkPaintbox('Blood Orange',      '#E05C1A'),
  mkPaintbox('Lipstick Pink',     '#E03D7A'),
  mkPaintbox('Daffodil Yellow',   '#FFD700'),
  mkPaintbox('Banana Cream',      '#FFF0A0'),
  mkPaintbox('Grass Green',       '#2D8C3A'),
  mkPaintbox('Racing Green',      '#1A5C2D'),
  mkPaintbox('Spearmint Green',   '#7ACCB3'),
  mkPaintbox('Melon Sorbet',      '#FFB37A'),
  mkPaintbox('Kingfisher Blue',   '#1A7AB3'),
  mkPaintbox('Pure Black',        '#0A0A0A'),
  mkPaintbox('Pure White',        '#FFFFFF'),
  mkPaintbox('Slate Grey',        '#6B6B6B'),
  mkPaintbox('Ink Blue',          '#1A3A6B'),
  mkPaintbox('Midnight Blue',     '#0A1A3F'),
  mkPaintbox('Sailor Blue',       '#1A4A8C'),
  mkPaintbox('Violet Purple',     '#6B2DBF'),
  mkPaintbox('Berry Red',         '#991A3A'),
  mkPaintbox('Mustard Yellow',    '#D4941A'),
  mkPaintbox('Tea Rose',          '#D4899A'),
];

// ---------------------------------------------------------------------------
// Color conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert a "#RRGGBB" hex string to CIELAB.
 * Returns lowercase a/b to match the function signature; internally converts
 * to uppercase A/B only when calling delta-e.
 */
export function hexToLab(hex: string): { L: number; a: number; b: number } {
  const clean = hex.replace('#', '');
  const [L, a, b] = convert.hex.lab(clean);
  return { L, a, b };
}

/**
 * Find the closest yarn color to the given hex using CIE ΔE76.
 * If brandId is provided, search is constrained to that brand.
 */
export function findNearestYarnColor(hex: string, brandId?: string): YarnColor {
  const candidates = brandId
    ? YARN_COLORS.filter((c) => c.brandId === brandId)
    : YARN_COLORS;

  // Fallback: if filtered list is empty (unknown brandId), use all colors
  const pool = candidates.length > 0 ? candidates : YARN_COLORS;

  return findNearestFromPool(hex, pool);
}

export function getYarnColorsByBrand(brandId: string): YarnColor[] {
  return YARN_COLORS.filter((color) => color.brandId === brandId);
}

export function findNearestYarnColorFromIds(hex: string, colorIds: string[]): YarnColor | null {
  if (colorIds.length === 0) {
    return null;
  }

  const selectedIds = new Set(colorIds);
  const pool = YARN_COLORS.filter((color) => selectedIds.has(color.id));

  if (pool.length === 0) {
    return null;
  }

  return findNearestFromPool(hex, pool);
}

function findNearestFromPool(hex: string, pool: YarnColor[]): YarnColor {
  if (pool.length === 0) {
    throw new Error('Cannot find nearest yarn color from an empty pool.');
  }

  const lab = hexToLab(hex);
  let best = pool[0];
  let bestDelta = Infinity;

  for (const color of pool) {
    const cLab = hexToLab(color.hex);
    const delta = DeltaE.getDeltaE76(
      { L: lab.L,   A: lab.a,   B: lab.b   },
      { L: cLab.L,  A: cLab.a,  B: cLab.b  },
    );
    if (delta < bestDelta) {
      bestDelta = delta;
      best = color;
    }
  }

  return best;
}

/**
 * Resolve a human-friendly color name for any hex color.
 * Uses nearest yarn color matching across all brands.
 */
export function getFriendlyColorName(hex: string): string {
  return findNearestYarnColor(hex).name;
}

/**
 * Returns the skein yardage for a brand, or 200 yards as a fallback.
 */
export function getSkeinYardage(brandId?: string): number {
  if (brandId && SKEIN_YARDAGES[brandId] !== undefined) {
    return SKEIN_YARDAGES[brandId];
  }
  return 200;
}
