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
  'i-love-this-yarn': 380,
  'yarn-bee': 232,
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

function mkILoveThisYarn(name: string, hex: string): YarnColor {
  return {
    id: `i-love-this-yarn-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
    name,
    brand: 'I Love this Yarn',
    brandId: 'i-love-this-yarn',
    hex,
    skeinYardage: 380,
  };
}

function mkYarnBee(name: string, hex: string): YarnColor {
  return {
    id: `yarn-bee-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
    name,
    brand: 'Yarn Bee Soft & Sleek DK',
    brandId: 'yarn-bee',
    hex,
    skeinYardage: 232,
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
  mkLion('Antique White', '#EFE5CF'),
  mkLion('Ecru',          '#DCC9A8'),
  mkLion('Blush',         '#F4C7C3'),
  mkLion('Rose Pink',     '#DE8FA1'),
  mkLion('Dusty Rose',    '#B97D8A'),
  mkLion('Coral',         '#F1786B'),
  mkLion('Peach',         '#F2B391'),
  mkLion('Apricot',       '#E7A565'),
  mkLion('Pumpkin',       '#D6712E'),
  mkLion('Rust',          '#9C4E2C'),
  mkLion('Chocolate',     '#5B3A2E'),
  mkLion('Mocha',         '#7A5A45'),
  mkLion('Sand',          '#C6AE8C'),
  mkLion('Camel',         '#B98B5E'),
  mkLion('Denim',         '#3B5C8A'),
  mkLion('Sky Blue',      '#8EC8F2'),
  mkLion('Ice Blue',      '#CFE9F9'),
  mkLion('Turquoise',     '#2AA8A1'),
  mkLion('Aqua',          '#78D1CC'),
  mkLion('Seafoam',       '#A7DCC6'),
  mkLion('Sage',          '#8FA384'),
  mkLion('Olive',         '#6F7445'),
  mkLion('Moss',          '#607845'),
  mkLion('Emerald',       '#1E8A5A'),
  mkLion('Lilac',         '#BDA5D9'),
  mkLion('Lavender',      '#C5B3E2'),
  mkLion('Periwinkle',    '#9BA9E3'),
  mkLion('Plum',          '#6C3F69'),
  mkLion('Charcoal',      '#3F4348'),
  mkLion('Silver Grey',   '#B5B9BD'),

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
  mkRedHeart('White',          '#FFFFFF'),
  mkRedHeart('Black',          '#161616'),
  mkRedHeart('Light Grey',     '#C3C3C3'),
  mkRedHeart('Charcoal',       '#4B4F55'),
  mkRedHeart('Cornmeal',       '#F2DA84'),
  mkRedHeart('Lemon',          '#F5E85A'),
  mkRedHeart('Gold',           '#D2A33B'),
  mkRedHeart('Pumpkin',        '#DE782D'),
  mkRedHeart('Carrot',         '#E7652B'),
  mkRedHeart('Coral',          '#F37A73'),
  mkRedHeart('Dusty Pink',     '#D79BB1'),
  mkRedHeart('Rose',           '#C96A83'),
  mkRedHeart('Magenta',        '#C52F8F'),
  mkRedHeart('Orchid',         '#A86ABC'),
  mkRedHeart('Eggplant',       '#573061'),
  mkRedHeart('Periwinkle',     '#8FA4E4'),
  mkRedHeart('Light Blue',     '#9DCCF8'),
  mkRedHeart('Denim',          '#3C5F96'),
  mkRedHeart('Navy',           '#1E2F60'),
  mkRedHeart('Turquoise',      '#29B0AE'),
  mkRedHeart('Aqua',           '#76CEC9'),
  mkRedHeart('Sea Green',      '#4D9B70'),
  mkRedHeart('Olive',          '#6D7245'),
  mkRedHeart('Hunter Green',   '#255A34'),
  mkRedHeart('Coffee',         '#7B5A46'),
  mkRedHeart('Chocolate',      '#5D3C2B'),
  mkRedHeart('Dusty Beige',    '#BFAE95'),
  mkRedHeart('Stone',          '#958C80'),

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
  mkCaron('White',                 '#FFFFFF'),
  mkCaron('Light Country Blue',    '#92B8D8'),
  mkCaron('Dark Country Blue',     '#375B8A'),
  mkCaron('Robin Egg',             '#90CAD5'),
  mkCaron('Blue Mint',             '#8AC9C4'),
  mkCaron('Mint Green',            '#A9D6B4'),
  mkCaron('Sage',                  '#8FAE8A'),
  mkCaron('Kelly Green',           '#2A8D54'),
  mkCaron('Lime',                  '#B2D957'),
  mkCaron('Sunshine',              '#F1D14C'),
  mkCaron('Gold',                  '#D7A73A'),
  mkCaron('Pumpkin',               '#D97936'),
  mkCaron('Persian Red',           '#B94A3D'),
  mkCaron('Harvest Red',           '#A13C36'),
  mkCaron('Watermelon',            '#E9748F'),
  mkCaron('Strawberry',            '#D64F74'),
  mkCaron('Fuchsia',               '#B73E98'),
  mkCaron('Orchid',                '#A578C6'),
  mkCaron('Amethyst',              '#7E5BA3'),
  mkCaron('Grape',                 '#5D3E7B'),
  mkCaron('Taupe',                 '#9D8B7C'),
  mkCaron('Taupe Heather',         '#887C73'),
  mkCaron('Chocolate',             '#5E4336'),
  mkCaron('Graphite',              '#565A61'),
  mkCaron('Silver',                '#BFC3C7'),
  mkCaron('Charcoal',              '#3B4047'),

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
  mkPaintbox('Neon Orange',       '#F06B1C'),
  mkPaintbox('Clementine',        '#EF8A2E'),
  mkPaintbox('Dusty Peach',       '#E8B19C'),
  mkPaintbox('Cameo Rose',        '#D9A2A8'),
  mkPaintbox('Bubblegum Pink',    '#E96CA8'),
  mkPaintbox('Magenta',           '#C23895'),
  mkPaintbox('Raspberry Pink',    '#B84273'),
  mkPaintbox('Bordeaux',          '#6F1E3D'),
  mkPaintbox('Plum Purple',       '#6F428A'),
  mkPaintbox('Lilac Mist',        '#B8A6D8'),
  mkPaintbox('Pansy Purple',      '#5A3D90'),
  mkPaintbox('Washed Teal',       '#5FA8A2'),
  mkPaintbox('Marine Blue',       '#1F5E9C'),
  mkPaintbox('Powder Blue',       '#A7C8EB'),
  mkPaintbox('Stormy Grey',       '#777C86'),
  mkPaintbox('Elephant Grey',     '#5E6470'),
  mkPaintbox('Pewter Grey',       '#979DA5'),
  mkPaintbox('Champagne White',   '#F6F1E5'),
  mkPaintbox('Vintage Cream',     '#EFE1C3'),
  mkPaintbox('Sandstone',         '#C8AC8C'),
  mkPaintbox('Soft Fudge',        '#8F674C'),
  mkPaintbox('Chocolate Brown',   '#5A3D2D'),
  mkPaintbox('Khaki Green',       '#8A8F63'),
  mkPaintbox('Moss Green',        '#5C7647'),
  mkPaintbox('Apple Green',       '#86B23E'),
  mkPaintbox('Lime Green',        '#A4CC4C'),
  mkPaintbox('Seafoam Blue',      '#8BCFC7'),
  mkPaintbox('Aquamarine',        '#65C6B9'),
  mkPaintbox('Denim Blue',        '#3569A5'),
  mkPaintbox('Royal Purple',      '#4D2E8A'),

  // ── I Love this Yarn ──────────────────────────────────────────────────────
  mkILoveThisYarn('White',           '#FFFFFF'),
  mkILoveThisYarn('Black',           '#0A0A0A'),
  mkILoveThisYarn('Light Grey',      '#D3D3D3'),
  mkILoveThisYarn('Charcoal',        '#3F4348'),
  mkILoveThisYarn('Silver',          '#C0C0C0'),
  mkILoveThisYarn('Cream',           '#FFFDD0'),
  mkILoveThisYarn('Ivory',           '#F0F8FF'),
  mkILoveThisYarn('Beige',           '#F5F5DC'),
  mkILoveThisYarn('Tan',             '#D2B48C'),
  mkILoveThisYarn('Gold',            '#FFD700'),
  mkILoveThisYarn('Red',             '#FF0000'),
  mkILoveThisYarn('Dark Red',        '#8B0000'),
  mkILoveThisYarn('Crimson',         '#DC143C'),
  mkILoveThisYarn('Coral',           '#FF7F50'),
  mkILoveThisYarn('Orange',          '#FFA500'),
  mkILoveThisYarn('Dark Orange',     '#FF8C00'),
  mkILoveThisYarn('Peach',           '#FFDAB9'),
  mkILoveThisYarn('Yellow',          '#FFFF00'),
  mkILoveThisYarn('Lime',            '#00FF00'),
  mkILoveThisYarn('Green',           '#008000'),
  mkILoveThisYarn('Dark Green',      '#006400'),
  mkILoveThisYarn('Forest Green',    '#228B22'),
  mkILoveThisYarn('Sea Green',       '#2E8B57'),
  mkILoveThisYarn('Teal',            '#008080'),
  mkILoveThisYarn('Cyan',            '#00FFFF'),
  mkILoveThisYarn('Sky Blue',        '#87CEEB'),
  mkILoveThisYarn('Blue',            '#0000FF'),
  mkILoveThisYarn('Navy',            '#000080'),
  mkILoveThisYarn('Royal Blue',      '#4169E1'),
  mkILoveThisYarn('Lavender',        '#E6E6FA'),
  mkILoveThisYarn('Purple',          '#800080'),
  mkILoveThisYarn('Violet',          '#EE82EE'),
  mkILoveThisYarn('Plum',            '#DDA0DD'),
  mkILoveThisYarn('Magenta',         '#FF00FF'),
  mkILoveThisYarn('Pink',            '#FFC0CB'),
  mkILoveThisYarn('Hot Pink',        '#FF69B4'),
  mkILoveThisYarn('Deep Pink',       '#FF1493'),
  mkILoveThisYarn('Rose',            '#FF007F'),
  mkILoveThisYarn('Brown',           '#A52A2A'),
  mkILoveThisYarn('Chocolate',       '#D2691E'),
  mkILoveThisYarn('Maroon',          '#800000'),

  // ── Yarn Bee Soft & Sleek DK ─────────────────────────────────────────────
  mkYarnBee('White',                 '#FFFFFF'),
  mkYarnBee('Black',                 '#111111'),
  mkYarnBee('Cream',                 '#F5EBDD'),
  mkYarnBee('Linen',                 '#D8C9B2'),
  mkYarnBee('Taupe',                 '#9A8774'),
  mkYarnBee('Silver',                '#B8BCC2'),
  mkYarnBee('Charcoal',              '#4A4F57'),
  mkYarnBee('Blush',                 '#E6B7BE'),
  mkYarnBee('Coral',                 '#E97F75'),
  mkYarnBee('Cherry',                '#BF2D3E'),
  mkYarnBee('Mustard',               '#C89B2D'),
  mkYarnBee('Sage',                  '#8FA487'),
  mkYarnBee('Teal',                  '#2E8A88'),
  mkYarnBee('Sky Blue',              '#8DBFE4'),
  mkYarnBee('Denim',                 '#3F5E8F'),
  mkYarnBee('Navy',                  '#21345E'),
  mkYarnBee('Lilac',                 '#B6A4D8'),
  mkYarnBee('Plum',                  '#6B4A79'),
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

export function getYarnColorById(colorId: string): YarnColor | undefined {
  return YARN_COLORS.find((color) => color.id === colorId);
}
export function findYarnColorByName(brandId: string, colorName: string): YarnColor | undefined {
  const lower = colorName.toLowerCase();
  return YARN_COLORS.find((c) => c.brandId === brandId && c.name.toLowerCase() === lower);
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function isNearWhiteTone(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);
  const avg = (r + g + b) / 3;
  const blueBias = b - r;
  const balancedChannels = Math.abs(r - g) <= 14 && Math.abs(g - b) <= 14 && Math.abs(r - b) <= 14;
  return avg >= 230 && minChannel >= 220 && (maxChannel - minChannel) <= 16 && balancedChannels && blueBias < 2;
}

function isLightCoolTone(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const minChannel = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  const coolBias = b - Math.max(r, g);
  return avg >= 166 && minChannel >= 102 && coolBias >= -5 && (b - r) >= 2;
}

function isLightPastelNonWhiteTone(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);
  const avg = (r + g + b) / 3;
  const warmDominance = r - b;
  return avg >= 168 && minChannel >= 104 && (maxChannel - minChannel) <= 90 && warmDominance < 36;
}

function isSnoutLikeFallbackTone(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);
  const avg = (r + g + b) / 3;

  // Avoid mapping warm/yellow highlights to gray.
  const stronglyWarmYellow = r > g + 26 && g > b + 10;
  if (stronglyWarmYellow) return false;

  // Light, low-to-medium chroma tones that are not true whites should fallback to gray.
  return avg >= 166 && minChannel >= 105 && (maxChannel - minChannel) <= 82;
}

function hasToken(name: string, tokens: string[]): boolean {
  const lower = name.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

function isLightGrayCandidate(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const avg = (r + g + b) / 3;
  return Math.abs(r - g) <= 18 && Math.abs(g - b) <= 18 && avg >= 88 && avg <= 244;
}

function hasBlueBias(hex: string): boolean {
  const { r, b } = hexToRgb(hex);
  return (b - r) >= 2;
}

function selectPreferredShade(hex: string, pool: YarnColor[]): YarnColor | null {
  if (pool.length === 0) return null;

  const lightGrayTokens = ['light grey', 'light gray', 'silver', 'grey heather', 'gray heather', 'slate grey', 'slate gray'];
  const grayPool = pool.filter((color) => hasToken(color.name, lightGrayTokens) || isLightGrayCandidate(color.hex));

  if (isLightCoolTone(hex)) {
    const lightBlueTokens = ['light blue', 'baby blue', 'sky blue', 'ice blue', 'powder blue', 'country blue'];
    const bluePool = pool.filter((color) => hasToken(color.name, lightBlueTokens));
    if (bluePool.length > 0) {
      return findNearestFromPoolRaw(hex, bluePool);
    }

    if (grayPool.length > 0) {
      return findNearestFromPoolRaw(hex, grayPool);
    }
  }

  // If the source is a light pastel (snout-like) but not true neutral white,
  // prefer gray fallback over white when no light-blue option exists.
  if (
    !isNearWhiteTone(hex) &&
    grayPool.length > 0 &&
    (isLightCoolTone(hex) || ((isLightPastelNonWhiteTone(hex) || isSnoutLikeFallbackTone(hex)) && hasBlueBias(hex)))
  ) {
    return findNearestFromPoolRaw(hex, grayPool);
  }

  if (isNearWhiteTone(hex) && !hasBlueBias(hex)) {
    const whiteTokens = ['white', 'off white', 'soft white', 'bone', 'fisherman', 'cream', 'ivory'];
    const whitePool = pool.filter((color) => hasToken(color.name, whiteTokens));
    if (whitePool.length > 0) {
      return findNearestFromPoolRaw(hex, whitePool);
    }
  }

  return null;
}

function findNearestFromPool(hex: string, pool: YarnColor[]): YarnColor {
  if (pool.length === 0) {
    throw new Error('Cannot find nearest yarn color from an empty pool.');
  }

  const preferred = selectPreferredShade(hex, pool);
  if (preferred) {
    return preferred;
  }

  return findNearestFromPoolRaw(hex, pool);
}

function findNearestFromPoolRaw(hex: string, pool: YarnColor[]): YarnColor {
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
