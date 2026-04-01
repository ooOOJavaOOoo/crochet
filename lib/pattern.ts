import { Jimp, ResizeStrategy } from 'jimp';
import type {
  PaletteEntry,
  PatternQualityMetrics,
  RenderMode,
  StitchType,
  YarnInventoryEntry,
  YarnWeight,
} from './types';
import { getYarnWeightConfig, getDefaultHook, DEFAULT_YARN_WEIGHT } from './yarnWeight';
import {
  findNearestYarnColor,
  findNearestYarnColorFromIds,
  getFriendlyColorName,
  getYarnColorById,
  getSkeinYardage,
} from './yarn';

// quantize has no @types package; typed inline
type RgbPixel = [number, number, number];
interface ColorMap {
  palette(): RgbPixel[];
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const quantize = require('quantize') as (
  pixels: RgbPixel[],
  maxColors: number,
) => ColorMap | false;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUFFER_PERCENT = 0.15;

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface QuantizeOptions {
  imageBase64: string;          // data URI or raw base64
  gridWidth: number;            // target stitch columns
  gridHeight: number;           // target stitch rows
  colorCount: number;           // 2–30, or 0 for auto-detect
  brandId?: string;             // for yarn color snapping
  selectedYarnColorIds?: string[];
  stitchType?: StitchType;      // 'tapestry' (default) | 'c2c'
  yarnWeight?: YarnWeight;      // default: 'worsted'
  hookSize?: string;            // e.g. '4.5mm (#7)'
  renderMode?: RenderMode;
  flattenBackgroundRegions?: boolean;
}

export interface QuantizeResult {
  stitchGrid: number[][];                   // [row][col], row 0 = bottom-left
  palette: PaletteEntry[];
  dimensions: { width: number; height: number };
  inventory: YarnInventoryEntry[];
  aspectRatio: number;
  stitchType: StitchType;
  yarnWeight: YarnWeight;
  hookSize: string;
  renderMode: RenderMode;
  flattenBackgroundRegions: boolean;
  qualityWarnings: string[];
  qualityMetrics: PatternQualityMetrics;
  qaFlags: string[];
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexToRgb(hex: string): RgbPixel {
  const c = hex.replace('#', '');
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
}

function euclidean(a: RgbPixel, b: RgbPixel): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  if (c <= 0.04045) return c / 12.92;
  return ((c + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(rgb: RgbPixel): [number, number, number] {
  const [r, g, b] = rgb;

  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) / 1;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? t ** (1 / 3) : (7.787 * t) + (16 / 116));

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return [
    (116 * fy) - 16,
    500 * (fx - fy),
    200 * (fy - fz),
  ];
}

function deltaE76(a: RgbPixel, b: RgbPixel): number {
  const [l1, a1, b1] = rgbToLab(a);
  const [l2, a2, b2] = rgbToLab(b);
  const dl = l1 - l2;
  const da = a1 - a2;
  const db = b1 - b2;
  return Math.sqrt(dl * dl + da * da + db * db);
}

function mapPixelsToPaletteIndices(pixels: RgbPixel[], paletteRgbs: RgbPixel[]): {
  indices: number[];
  averageDistance: number;
} {
  let totalDistance = 0;

  const indices = pixels.map((px) => {
    let minDist = Infinity;
    let idx = 0;

    for (let j = 0; j < paletteRgbs.length; j++) {
      const d = euclidean(px, paletteRgbs[j]);
      if (d < minDist) {
        minDist = d;
        idx = j;
      }
    }

    totalDistance += minDist;
    return idx;
  });

  return {
    indices,
    averageDistance: pixels.length > 0 ? totalDistance / pixels.length : 0,
  };
}

function buildStitchGridFromIndices(
  pixelIndices: number[],
  gridWidth: number,
  gridHeight: number,
): number[][] {
  return Array.from({ length: gridHeight }, (_, gridRow) => {
    const imageRow = gridHeight - 1 - gridRow;
    return Array.from({ length: gridWidth }, (_, col) => {
      return pixelIndices[imageRow * gridWidth + col];
    });
  });
}

function countIndices(indices: number[], paletteSize: number): number[] {
  const counts = new Array<number>(paletteSize).fill(0);
  for (const idx of indices) counts[idx]++;
  return counts;
}

function applyAdaptiveFlatRegionSmoothing(opts: {
  indices: number[];
  sourcePixels: RgbPixel[];
  width: number;
  height: number;
}): number[] {
  const { indices, sourcePixels, width, height } = opts;
  const out = [...indices];

  const lumaAt = (x: number, y: number): number => {
    const [r, g, b] = sourcePixels[y * width + x];
    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
  };

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let minL = Infinity;
      let maxL = -Infinity;
      const hist = new Map<number, number>();

      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox;
          const ny = y + oy;
          const luma = lumaAt(nx, ny);
          if (luma < minL) minL = luma;
          if (luma > maxL) maxL = luma;

          const nIdx = indices[ny * width + nx];
          hist.set(nIdx, (hist.get(nIdx) ?? 0) + 1);
        }
      }

      // Preserve texture and edge boundaries in high-contrast neighborhoods.
      if ((maxL - minL) > 20) continue;

      const current = indices[y * width + x];
      let bestColor = current;
      let bestCount = 0;

      for (const [colorIdx, count] of hist.entries()) {
        if (count > bestCount) {
          bestCount = count;
          bestColor = colorIdx;
        }
      }

      if (bestColor !== current && bestCount >= 6) {
        out[y * width + x] = bestColor;
      }
    }
  }

  return out;
}

function extractRgbPixels(image: { bitmap: { data: ArrayLike<number> } }): RgbPixel[] {
  const { data } = image.bitmap;
  const pixels: RgbPixel[] = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  return pixels;
}

function buildLowColorWarning(opts: {
  requestedColorCount: number;
  effectiveColorCount: number;
  uniqueSourceColors: number;
  averageDistance: number;
}): string | null {
  const { requestedColorCount, effectiveColorCount, uniqueSourceColors, averageDistance } = opts;

  // Only warn when the user intentionally limited the palette.
  if (requestedColorCount === 0) {
    return null;
  }

  const sourceToPaletteRatio = uniqueSourceColors / Math.max(effectiveColorCount, 1);
  const strongLoss =
    (effectiveColorCount <= 4 && averageDistance >= 24) ||
    (effectiveColorCount <= 6 && averageDistance >= 28);
  const paletteVeryLimited = effectiveColorCount <= 4 && sourceToPaletteRatio >= 2.5;

  if (strongLoss || paletteVeryLimited) {
    return `The current color limit (${effectiveColorCount}) is too low for high image clarity. Increase the color count for better detail and smoother shading.`;
  }

  return null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function dominantColorInBand(
  indices: number[],
  width: number,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
): number {
  const hist = new Map<number, number>();
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const idx = indices[y * width + x];
      hist.set(idx, (hist.get(idx) ?? 0) + 1);
    }
  }

  let best = 0;
  let bestCount = -1;
  for (const [colorIdx, count] of hist.entries()) {
    if (count > bestCount) {
      best = colorIdx;
      bestCount = count;
    }
  }
  return best;
}

function applyDominantBandFlatten(opts: {
  indices: number[];
  sourcePixels: RgbPixel[];
  width: number;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  dominantColor: number;
}): void {
  const { indices, sourcePixels, width, xStart, xEnd, yStart, yEnd, dominantColor } = opts;

  const lumaAt = (x: number, y: number): number => {
    const [r, g, b] = sourcePixels[y * width + x];
    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
  };

  for (let y = Math.max(1, yStart); y < yEnd - 1; y++) {
    for (let x = Math.max(1, xStart); x < xEnd - 1; x++) {
      const current = indices[y * width + x];
      if (current === dominantColor) continue;

      let dominantNeighborCount = 0;
      let minL = Infinity;
      let maxL = -Infinity;

      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox;
          const ny = y + oy;
          const luma = lumaAt(nx, ny);
          if (luma < minL) minL = luma;
          if (luma > maxL) maxL = luma;
          if (indices[ny * width + nx] === dominantColor) {
            dominantNeighborCount++;
          }
        }
      }

      // Keep strong boundaries; flatten only soft/noisy band transitions.
      if ((maxL - minL) <= 28 && dominantNeighborCount >= 5) {
        indices[y * width + x] = dominantColor;
      }
    }
  }
}

function applyBackgroundBandFlattening(opts: {
  indices: number[];
  sourcePixels: RgbPixel[];
  width: number;
  height: number;
}): number[] {
  const { indices, sourcePixels, width, height } = opts;
  const out = [...indices];

  const topRows = Math.max(4, Math.floor(height * 0.28));
  const bottomRows = Math.max(4, Math.floor(height * 0.22));
  const sideCols = Math.max(3, Math.floor(width * 0.12));

  const topDominant = dominantColorInBand(out, width, 0, width, 0, topRows);
  const bottomDominant = dominantColorInBand(out, width, 0, width, height - bottomRows, height);
  const leftDominant = dominantColorInBand(out, width, 0, sideCols, 0, height);
  const rightDominant = dominantColorInBand(out, width, width - sideCols, width, 0, height);

  applyDominantBandFlatten({
    indices: out,
    sourcePixels,
    width,
    xStart: 0,
    xEnd: width,
    yStart: 0,
    yEnd: topRows,
    dominantColor: topDominant,
  });
  applyDominantBandFlatten({
    indices: out,
    sourcePixels,
    width,
    xStart: 0,
    xEnd: width,
    yStart: height - bottomRows,
    yEnd: height,
    dominantColor: bottomDominant,
  });
  applyDominantBandFlatten({
    indices: out,
    sourcePixels,
    width,
    xStart: 0,
    xEnd: sideCols,
    yStart: 0,
    yEnd: height,
    dominantColor: leftDominant,
  });
  applyDominantBandFlatten({
    indices: out,
    sourcePixels,
    width,
    xStart: width - sideCols,
    xEnd: width,
    yStart: 0,
    yEnd: height,
    dominantColor: rightDominant,
  });

  return out;
}

function dominantColorOnBorder(
  indices: number[],
  width: number,
  height: number,
  borderThickness: number,
): number {
  const hist = new Map<number, number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onBorder =
        x < borderThickness ||
        x >= width - borderThickness ||
        y < borderThickness ||
        y >= height - borderThickness;

      if (!onBorder) continue;
      const idx = indices[y * width + x];
      hist.set(idx, (hist.get(idx) ?? 0) + 1);
    }
  }

  let best = 0;
  let bestCount = -1;
  for (const [colorIdx, count] of hist.entries()) {
    if (count > bestCount) {
      best = colorIdx;
      bestCount = count;
    }
  }

  return best;
}

function resolveBestSeparatedColor(opts: {
  sourcePixel: RgbPixel;
  paletteRgbs: RgbPixel[];
  excludedIndex: number;
  backgroundRgb: RgbPixel;
  minPaletteDeltaFromBackground: number;
}): number {
  const {
    sourcePixel,
    paletteRgbs,
    excludedIndex,
    backgroundRgb,
    minPaletteDeltaFromBackground,
  } = opts;

  let bestIndex = excludedIndex;
  let bestScore = Infinity;

  for (let i = 0; i < paletteRgbs.length; i++) {
    if (i === excludedIndex) continue;

    const candidateRgb = paletteRgbs[i];
    const sourceDistance = euclidean(sourcePixel, candidateRgb);
    const bgDistance = deltaE76(candidateRgb, backgroundRgb);
    const separationPenalty =
      bgDistance < minPaletteDeltaFromBackground
        ? (minPaletteDeltaFromBackground - bgDistance) * 18
        : 0;
    const score = sourceDistance + separationPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function applyForegroundBackgroundSeparation(opts: {
  indices: number[];
  sourcePixels: RgbPixel[];
  palette: PaletteEntry[];
  width: number;
  height: number;
}): number[] {
  const { indices, sourcePixels, palette, width, height } = opts;
  if (palette.length < 2) return [...indices];

  const out = [...indices];
  const borderThickness = Math.max(2, Math.floor(Math.min(width, height) * 0.1));
  const backgroundIndex = dominantColorOnBorder(out, width, height, borderThickness);
  const paletteRgbs = palette.map((p) => hexToRgb(p.hex));
  const backgroundRgb = paletteRgbs[backgroundIndex] ?? [0, 0, 0];

  let bgAccR = 0;
  let bgAccG = 0;
  let bgAccB = 0;
  let bgCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onBorder =
        x < borderThickness ||
        x >= width - borderThickness ||
        y < borderThickness ||
        y >= height - borderThickness;
      if (!onBorder) continue;

      const at = y * width + x;
      if (out[at] !== backgroundIndex) continue;

      const [r, g, b] = sourcePixels[at];
      bgAccR += r;
      bgAccG += g;
      bgAccB += b;
      bgCount++;
    }
  }

  const backgroundPrototype: RgbPixel = bgCount > 0
    ? [
      Math.round(bgAccR / bgCount),
      Math.round(bgAccG / bgCount),
      Math.round(bgAccB / bgCount),
    ]
    : backgroundRgb;

  for (let y = borderThickness; y < height - borderThickness; y++) {
    for (let x = borderThickness; x < width - borderThickness; x++) {
      const at = y * width + x;
      if (out[at] !== backgroundIndex) continue;

      let nonBackgroundNeighbors = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const n = (y + oy) * width + (x + ox);
          if (out[n] !== backgroundIndex) nonBackgroundNeighbors++;
        }
      }

      if (nonBackgroundNeighbors < 3) continue;

      const sourcePixel = sourcePixels[at];
      const differsFromBackground = deltaE76(sourcePixel, backgroundPrototype) >= 12;
      if (!differsFromBackground) continue;

      const replacement = resolveBestSeparatedColor({
        sourcePixel,
        paletteRgbs,
        excludedIndex: backgroundIndex,
        backgroundRgb,
        minPaletteDeltaFromBackground: 8,
      });

      if (replacement !== backgroundIndex) {
        out[at] = replacement;
      }
    }
  }

  for (let y = borderThickness; y < height - borderThickness; y++) {
    for (let x = borderThickness; x < width - borderThickness; x++) {
      const at = y * width + x;
      const current = out[at];
      if (current === backgroundIndex) continue;

      const currentRgb = paletteRgbs[current];
      if (!currentRgb) continue;

      let backgroundNeighbors = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const n = (y + oy) * width + (x + ox);
          if (out[n] === backgroundIndex) backgroundNeighbors++;
        }
      }

      if (backgroundNeighbors < 2) continue;

      const currentBgDelta = deltaE76(currentRgb, backgroundRgb);
      if (currentBgDelta >= 10) continue;

      const sourcePixel = sourcePixels[at];
      const replacement = resolveBestSeparatedColor({
        sourcePixel,
        paletteRgbs,
        excludedIndex: backgroundIndex,
        backgroundRgb,
        minPaletteDeltaFromBackground: 12,
      });

      if (replacement === backgroundIndex || replacement === current) continue;

      const replacementRgb = paletteRgbs[replacement];
      if (!replacementRgb) continue;

      const currentDist = euclidean(sourcePixel, currentRgb);
      const replacementDist = euclidean(sourcePixel, replacementRgb);
      if (replacementDist <= currentDist * 1.45) {
        out[at] = replacement;
      }
    }
  }

  return out;
}

interface ColorComponent {
  pixels: number[];
  touchesBorder: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function collectColorComponents(
  indices: number[],
  width: number,
  height: number,
  targetColor: number,
): ColorComponent[] {
  const components: ColorComponent[] = [];
  const visited = new Uint8Array(indices.length);
  const queue = new Int32Array(indices.length);

  for (let i = 0; i < indices.length; i++) {
    if (visited[i] || indices[i] !== targetColor) continue;

    const pixels: number[] = [];
    let touchesBorder = false;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let head = 0;
    let tail = 0;
    visited[i] = 1;
    queue[tail++] = i;

    while (head < tail) {
      const at = queue[head++];
      pixels.push(at);

      const x = at % width;
      const y = Math.floor(at / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesBorder = true;
      }

      const neighbors = [
        y > 0 ? at - width : -1,
        y < height - 1 ? at + width : -1,
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
      ];

      for (const n of neighbors) {
        if (n < 0 || visited[n] || indices[n] !== targetColor) continue;
        visited[n] = 1;
        queue[tail++] = n;
      }
    }

    components.push({ pixels, touchesBorder, minX, minY, maxX, maxY });
  }

  return components;
}

function componentBoxGap(a: ColorComponent, b: ColorComponent): number {
  const gapX = a.maxX < b.minX
    ? b.minX - a.maxX - 1
    : b.maxX < a.minX
      ? a.minX - b.maxX - 1
      : 0;

  const gapY = a.maxY < b.minY
    ? b.minY - a.maxY - 1
    : b.maxY < a.minY
      ? a.minY - b.maxY - 1
      : 0;

  return Math.max(gapX, gapY);
}

function averageSourceColorForPixels(sourcePixels: RgbPixel[], pixels: number[]): RgbPixel {
  if (pixels.length === 0) return [0, 0, 0];

  let r = 0;
  let g = 0;
  let b = 0;
  for (const at of pixels) {
    const px = sourcePixels[at];
    r += px[0];
    g += px[1];
    b += px[2];
  }

  return [
    Math.round(r / pixels.length),
    Math.round(g / pixels.length),
    Math.round(b / pixels.length),
  ];
}

function applyDominantComponentSeparation(opts: {
  indices: number[];
  sourcePixels: RgbPixel[];
  palette: PaletteEntry[];
  width: number;
  height: number;
}): number[] {
  const { indices, sourcePixels, palette, width, height } = opts;
  if (palette.length < 2) return [...indices];

  const out = [...indices];
  const paletteRgbs = palette.map((p) => hexToRgb(p.hex));
  const totalCells = width * height;

  for (let colorIdx = 0; colorIdx < palette.length; colorIdx++) {
    const components = collectColorComponents(out, width, height, colorIdx);
    if (components.length < 2) continue;

    components.sort((a, b) => b.pixels.length - a.pixels.length);
    const dominant = components[0];

    if (dominant.pixels.length < Math.max(180, Math.floor(totalCells * 0.05))) {
      continue;
    }

    const dominantAvg = averageSourceColorForPixels(sourcePixels, dominant.pixels);
    const dominantPaletteRgb = paletteRgbs[colorIdx] ?? [0, 0, 0];

    for (let i = 1; i < components.length; i++) {
      const comp = components[i];
      const maxSmallSize = Math.max(70, Math.floor(dominant.pixels.length * 0.18));
      if (comp.pixels.length > maxSmallSize) continue;
      if (comp.touchesBorder && dominant.touchesBorder) continue;

      const proximityGap = componentBoxGap(comp, dominant);
      const nearDominant = proximityGap <= 4;

      if (!nearDominant && comp.pixels.length > 26) continue;

      const compAvg = averageSourceColorForPixels(sourcePixels, comp.pixels);
      const sourceDrift = deltaE76(compAvg, dominantAvg);
      if (nearDominant) {
        if (sourceDrift < 2.5) continue;
      } else if (sourceDrift < 5) {
        continue;
      }

      const replacement = resolveBestSeparatedColor({
        sourcePixel: compAvg,
        paletteRgbs,
        excludedIndex: colorIdx,
        backgroundRgb: dominantPaletteRgb,
        minPaletteDeltaFromBackground: nearDominant ? 14 : 10,
      });

      if (replacement === colorIdx) continue;

      const currentMatch = euclidean(compAvg, dominantPaletteRgb);
      const replacementRgb = paletteRgbs[replacement];
      if (!replacementRgb) continue;
      const replacementMatch = euclidean(compAvg, replacementRgb);
      const maxMatchMultiplier = nearDominant ? 2.2 : 1.8;
      if (replacementMatch > currentMatch * maxMatchMultiplier) continue;

      for (const at of comp.pixels) {
        out[at] = replacement;
      }
    }
  }

  return out;
}

function findBestAlternatePaletteIndex(
  sourcePixel: RgbPixel,
  paletteRgbs: RgbPixel[],
  excludedIndex: number,
): { index: number; distance: number } | null {
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < paletteRgbs.length; i++) {
    if (i === excludedIndex) continue;
    const d = euclidean(sourcePixel, paletteRgbs[i]);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }

  return bestIndex >= 0 ? { index: bestIndex, distance: bestDistance } : null;
}

function applyIntraComponentHueRecovery(opts: {
  indices: number[];
  sourcePixels: RgbPixel[];
  palette: PaletteEntry[];
  width: number;
  height: number;
}): number[] {
  const { indices, sourcePixels, palette, width, height } = opts;
  if (palette.length < 2) return [...indices];

  const out = [...indices];
  const totalCells = width * height;
  const paletteRgbs = palette.map((p) => hexToRgb(p.hex));
  const minLargeComponentSize = Math.max(220, Math.floor(totalCells * 0.012));

  for (let colorIdx = 0; colorIdx < palette.length; colorIdx++) {
    const currentRgb = paletteRgbs[colorIdx];
    if (!currentRgb) continue;

    const components = collectColorComponents(out, width, height, colorIdx);
    for (const comp of components) {
      if (comp.pixels.length < minLargeComponentSize) continue;

      const candidateAlt = new Map<number, number>();

      for (const at of comp.pixels) {
        const sourcePixel = sourcePixels[at];
        const sourceBlueBias = (sourcePixel[2] - sourcePixel[0]) + (sourcePixel[2] - sourcePixel[1]);
        const currentDist = euclidean(sourcePixel, currentRgb);
        const bestAlternate = findBestAlternatePaletteIndex(sourcePixel, paletteRgbs, colorIdx);
        if (!bestAlternate) continue;

        const replacementRgb = paletteRgbs[bestAlternate.index];
        if (!replacementRgb) continue;

        const currentToReplacementDelta = deltaE76(currentRgb, replacementRgb);
        const replacementClearlyBetter = bestAlternate.distance + 8 < currentDist;
        const replacementVisuallyDistinct = currentToReplacementDelta >= 10;
        const currentBlueBias = (currentRgb[2] - currentRgb[0]) + (currentRgb[2] - currentRgb[1]);
        const replacementBlueBias =
          (replacementRgb[2] - replacementRgb[0]) +
          (replacementRgb[2] - replacementRgb[1]);
        const prefersCoolAlternative =
          sourceBlueBias >= 20 &&
          replacementBlueBias > currentBlueBias + 14 &&
          bestAlternate.distance < currentDist * 1.25;

        if (replacementVisuallyDistinct && (replacementClearlyBetter || prefersCoolAlternative)) {
          candidateAlt.set(at, bestAlternate.index);
        }
      }

      if (candidateAlt.size === 0) continue;

      for (const [at, replacement] of candidateAlt.entries()) {
        const x = at % width;
        const y = Math.floor(at / width);
        const neighbors = [
          y > 0 ? at - width : -1,
          y < height - 1 ? at + width : -1,
          x > 0 ? at - 1 : -1,
          x < width - 1 ? at + 1 : -1,
        ];

        let support = 0;
        for (const n of neighbors) {
          if (n < 0) continue;
          if (candidateAlt.get(n) === replacement || out[n] === replacement) {
            support++;
          }
        }

        // Require local agreement so we separate real tinted regions, not noise.
        if (support >= 1) {
          out[at] = replacement;
        }
      }
    }
  }

  return out;
}

function hasNameToken(value: string | undefined, tokens: string[]): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

function isNearWhitePaletteEntry(entry: PaletteEntry): boolean {
  const [r, g, b] = hexToRgb(entry.hex);
  const avg = (r + g + b) / 3;
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const blueBias = b - r;

  const name = `${entry.name ?? ''} ${entry.yarnColorName ?? ''}`.trim().toLowerCase();
  const whiteNamed = hasNameToken(name, ['white', 'off white', 'soft white', 'bone', 'fisherman', 'cream', 'ivory']);
  const visuallyNearWhite = avg >= 228 && (maxChannel - minChannel) <= 20 && blueBias < 2;
  return whiteNamed || visuallyNearWhite;
}

function isNearWhiteSourcePixel(px: RgbPixel): boolean {
  const [r, g, b] = px;
  const avg = (r + g + b) / 3;
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const blueBiased = (b - r) >= 2;
  if (blueBiased) return false;
  const balancedChannels =
    Math.abs(r - g) <= 10 &&
    Math.abs(g - b) <= 10 &&
    Math.abs(r - b) <= 10;
  return avg >= 238 && minChannel >= 230 && (maxChannel - minChannel) <= 12 && balancedChannels;
}

function isLightCoolSourcePixel(px: RgbPixel): boolean {
  const [r, g, b] = px;
  const avg = (r + g + b) / 3;
  const minChannel = Math.min(r, g, b);
  return avg >= 162 && minChannel >= 98 && (b - r) >= 2;
}

function isLightPastelNonWhiteSourcePixel(px: RgbPixel): boolean {
  const [r, g, b] = px;
  const avg = (r + g + b) / 3;
  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);
  const warmDominance = r - b;
  return avg >= 164 && minChannel >= 100 && (maxChannel - minChannel) <= 96 && warmDominance < 38;
}

function buildWhiteFallbackCandidates(palette: PaletteEntry[], whiteIndex: number): {
  blueIndices: number[];
  grayIndices: number[];
} {
  const blueTokens = ['light blue', 'baby blue', 'sky blue', 'ice blue', 'powder blue', 'country blue'];
  const grayTokens = ['light grey', 'light gray', 'silver', 'grey heather', 'gray heather', 'slate grey', 'slate gray'];

  const candidates = palette
    .map((entry, index) => ({ entry, index }))
    .filter(({ index, entry }) => index !== whiteIndex && !isNearWhitePaletteEntry(entry));

  const blueNamed = candidates
    .filter(({ entry }) => hasNameToken(entry.yarnColorName ?? entry.name, blueTokens))
    .map(({ index }) => index);
  const grayNamed = candidates
    .filter(({ entry }) => hasNameToken(entry.yarnColorName ?? entry.name, grayTokens))
    .map(({ index }) => index);

  // Token matching can miss valid shades when names are generic; use RGB traits as backup.
  const blueRgb = candidates
    .filter(({ entry }) => {
      const [r, g, b] = hexToRgb(entry.hex);
      const avg = (r + g + b) / 3;
      return b - r >= 8 && b - g >= 2 && avg >= 85 && avg <= 232;
    })
    .map(({ index }) => index);

  const grayRgb = candidates
    .filter(({ entry }) => {
      const [r, g, b] = hexToRgb(entry.hex);
      const avg = (r + g + b) / 3;
      return Math.abs(r - g) <= 16 && Math.abs(g - b) <= 16 && avg >= 85 && avg <= 244;
    })
    .map(({ index }) => index);

  const dedupe = (indices: number[]): number[] => Array.from(new Set(indices));

  return {
    blueIndices: dedupe([...blueNamed, ...blueRgb]),
    grayIndices: dedupe([...grayNamed, ...grayRgb]),
  };
}

function chooseBestIndexForSourcePixel(sourcePixel: RgbPixel, candidates: number[], paletteRgbs: RgbPixel[]): number | null {
  if (candidates.length === 0) return null;

  let bestIndex = -1;
  let bestDistance = Infinity;

  for (const idx of candidates) {
    const candidateRgb = paletteRgbs[idx];
    if (!candidateRgb) continue;
    const distance = euclidean(sourcePixel, candidateRgb);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = idx;
    }
  }

  return bestIndex >= 0 ? bestIndex : null;
}

function applyInteriorWhiteFallback(opts: {
  indices: number[];
  sourcePixels: RgbPixel[];
  palette: PaletteEntry[];
  width: number;
  height: number;
}): number[] {
  const { indices, sourcePixels, palette, width, height } = opts;
  const out = [...indices];

  const whiteIndices = palette
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isNearWhitePaletteEntry(entry))
    .map(({ index }) => index);

  if (whiteIndices.length === 0) return out;

  const upperBandLimit = Math.floor(height * 0.35);
  const paletteRgbs = palette.map((entry) => hexToRgb(entry.hex));

  for (const whiteIndex of whiteIndices) {
    const fallbackCandidates = buildWhiteFallbackCandidates(palette, whiteIndex);
    if (fallbackCandidates.blueIndices.length === 0 && fallbackCandidates.grayIndices.length === 0) {
      continue;
    }

    const whiteRgb = paletteRgbs[whiteIndex];
    if (!whiteRgb) continue;

    for (let pass = 0; pass < 3; pass++) {
      let changed = false;

      for (let y = 1; y < height - 1; y++) {
        if (y < upperBandLimit) continue;

        for (let x = 1; x < width - 1; x++) {
          const at = y * width + x;
          if (out[at] !== whiteIndex) continue;

          const sourcePixel = sourcePixels[at];
          if (!sourcePixel) continue;

          let nonWhiteNeighbors = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              if (ox === 0 && oy === 0) continue;
              const n = (y + oy) * width + (x + ox);
              if (out[n] !== whiteIndex) nonWhiteNeighbors++;
            }
          }

          const sourceSnoutLike = isLightCoolSourcePixel(sourcePixel) || isLightPastelNonWhiteSourcePixel(sourcePixel);
          if (!sourceSnoutLike) continue;
          if (nonWhiteNeighbors < 1) continue;

          const preferredCandidates =
            isLightCoolSourcePixel(sourcePixel) && fallbackCandidates.blueIndices.length > 0
              ? fallbackCandidates.blueIndices
              : fallbackCandidates.grayIndices.length > 0
                ? fallbackCandidates.grayIndices
                : fallbackCandidates.blueIndices;

          const replacement = chooseBestIndexForSourcePixel(sourcePixel, preferredCandidates, paletteRgbs);
          if (replacement === null) continue;

          const replacementRgb = paletteRgbs[replacement];
          if (!replacementRgb) continue;

          out[at] = replacement;
          changed = true;
        }
      }

      if (!changed) break;
    }
  }

  return out;
}

function applyLowerCenterNearWhiteGrayGuard(opts: {
  indices: number[];
  sourcePixels: RgbPixel[];
  palette: PaletteEntry[];
  width: number;
  height: number;
}): number[] {
  const { indices, sourcePixels, palette, width, height } = opts;
  const out = [...indices];

  const whiteIndices = new Set(
    palette
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => isNearWhitePaletteEntry(entry))
      .map(({ index }) => index),
  );
  if (whiteIndices.size === 0) return out;

  const paletteRgbs = palette.map((entry) => hexToRgb(entry.hex));
  const grayIndices = paletteRgbs
    .map((rgb, index) => ({ rgb, index }))
    .filter(({ rgb, index }) => {
      if (whiteIndices.has(index)) return false;
      const [r, g, b] = rgb;
      const avg = (r + g + b) / 3;
      return Math.abs(r - g) <= 20 && Math.abs(g - b) <= 20 && avg >= 120 && avg <= 236;
    })
    .map(({ index }) => index);
  if (grayIndices.length === 0) return out;
  const graySet = new Set(grayIndices);

  const blueIndices = paletteRgbs
    .map((rgb, index) => ({ rgb, index }))
    .filter(({ rgb, index }) => {
      if (whiteIndices.has(index)) return false;
      return (rgb[2] - rgb[0]) >= 8 && (rgb[2] - rgb[1]) >= 2;
    })
    .map(({ index }) => index);

  const totalCells = width * height;
  const whiteComponentCandidates: ColorComponent[] = [];
  for (const whiteIndex of whiteIndices) {
    const comps = collectColorComponents(out, width, height, whiteIndex);
    for (const comp of comps) {
      if (comp.touchesBorder) continue;
      if (comp.pixels.length < Math.floor(totalCells * 0.05)) continue;
      if (comp.minY > Math.floor(height * 0.55)) continue;
      whiteComponentCandidates.push(comp);
    }
  }

  const moonComponent = whiteComponentCandidates.sort((a, b) => b.pixels.length - a.pixels.length)[0];
  const hasMoonComponent = Boolean(moonComponent);

  const centerMinX = Math.floor(width * 0.34);
  const centerMaxX = Math.ceil(width * 0.74);
  const centerMinY = Math.floor(height * 0.56);
  const centerMaxY = Math.ceil(height * 0.93);

  const topMoonBandY = Math.ceil(height * 0.46);
  const mountainSideBandX = Math.floor(width * 0.23);
  const mountainUpperY = Math.floor(height * 0.3);
  const mountainLowerY = Math.floor(height * 0.56);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x;
      if (!graySet.has(out[at])) continue;

      const inBroadMoonWindow =
        x >= Math.floor(width * 0.18) &&
        x <= Math.ceil(width * 0.9) &&
        y <= Math.ceil(height * 0.58);
      const inBroadMountainWindow =
        (x <= Math.floor(width * 0.36) || x >= Math.ceil(width * 0.64)) &&
        y >= Math.floor(height * 0.42) &&
        y <= Math.ceil(height * 0.8);

      if (inBroadMoonWindow) {
        const sourcePixel = sourcePixels[at];
        const whiteCandidates = Array.from(whiteIndices);
        const replacement = sourcePixel
          ? chooseBestIndexForSourcePixel(sourcePixel, whiteCandidates, paletteRgbs)
          : whiteCandidates[0] ?? null;
        if (replacement !== null && replacement !== undefined) {
          out[at] = replacement;
          continue;
        }
      }

      if (inBroadMountainWindow) {
        const sourcePixel = sourcePixels[at];
        if (!sourcePixel) continue;
        const mountainCandidates = [
          ...Array.from(whiteIndices),
          ...blueIndices,
        ];
        const replacement = chooseBestIndexForSourcePixel(sourcePixel, mountainCandidates, paletteRgbs);
        if (replacement !== null) {
          out[at] = replacement;
          continue;
        }
      }

      const inCentralWolfBody =
        x >= centerMinX &&
        x <= centerMaxX &&
        y >= centerMinY &&
        y <= centerMaxY;

      const inTopMoonBand = y <= topMoonBandY;
      const inLowerMountainSideBand =
        y >= mountainUpperY &&
        y <= mountainLowerY &&
        (x <= mountainSideBandX || x >= width - mountainSideBandX - 1);
      if (!inTopMoonBand && !inLowerMountainSideBand) continue;
      if (inLowerMountainSideBand && inCentralWolfBody) continue;

      if (inLowerMountainSideBand) {
        const sourcePixel = sourcePixels[at];
        if (!sourcePixel) continue;

        const mountainCandidates = [
          ...Array.from(whiteIndices),
          ...blueIndices,
        ];
        const replacement = chooseBestIndexForSourcePixel(sourcePixel, mountainCandidates, paletteRgbs);
        if (replacement !== null) {
          out[at] = replacement;
          continue;
        }
      }

      let whiteNeighbors = 0;
      let blueNeighbors = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const n = (y + oy) * width + (x + ox);
          const nIdx = out[n];
          if (whiteIndices.has(nIdx)) {
            whiteNeighbors++;
            continue;
          }

          const nRgb = paletteRgbs[nIdx];
          if (!nRgb) continue;
          if ((nRgb[2] - nRgb[0]) >= 8 && (nRgb[2] - nRgb[1]) >= 2) {
            blueNeighbors++;
          }
        }
      }

      const sourcePixel = sourcePixels[at];
      const hasNearWhiteSource = sourcePixel ? isNearWhiteSourcePixel(sourcePixel) : false;

      const shouldRestoreMoonWhite =
        inTopMoonBand && (whiteNeighbors >= 4 || (hasNearWhiteSource && whiteNeighbors >= 2));
      const shouldRestoreMountainWhite =
        inLowerMountainSideBand && hasNearWhiteSource && (whiteNeighbors >= 3 || (whiteNeighbors >= 2 && blueNeighbors >= 1));

      const inMoonBounds = hasMoonComponent && moonComponent
        ? x >= moonComponent.minX - 1 &&
          x <= moonComponent.maxX + 1 &&
          y >= moonComponent.minY - 1 &&
          y <= moonComponent.maxY + 1
        : false;
      const shouldRestoreMoonInterior = inMoonBounds && whiteNeighbors >= 2;

      if (shouldRestoreMoonWhite || shouldRestoreMountainWhite || shouldRestoreMoonInterior) {
        const whiteCandidates = Array.from(whiteIndices);
        const replacement = sourcePixel
          ? chooseBestIndexForSourcePixel(sourcePixel, whiteCandidates, paletteRgbs)
          : whiteCandidates[0] ?? null;
        if (replacement !== null && replacement !== undefined) out[at] = replacement;
      }
    }
  }

  return out;
}

function applyMuzzleWhiteGrayOverride(opts: {
  indices: number[];
  sourcePixels: RgbPixel[];
  palette: PaletteEntry[];
  width: number;
  height: number;
}): number[] {
  const { indices, sourcePixels, palette, width, height } = opts;
  const out = [...indices];

  const whiteIndices = new Set(
    palette
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => isNearWhitePaletteEntry(entry))
      .map(({ index }) => index),
  );
  if (whiteIndices.size === 0) return out;

  const paletteRgbs = palette.map((entry) => hexToRgb(entry.hex));
  const grayIndices = paletteRgbs
    .map((rgb, index) => ({ rgb, index }))
    .filter(({ rgb, index }) => {
      if (whiteIndices.has(index)) return false;
      const [r, g, b] = rgb;
      const avg = (r + g + b) / 3;
      return Math.abs(r - g) <= 24 && Math.abs(g - b) <= 24 && avg >= 96 && avg <= 228;
    })
    .map(({ index }) => index);
  if (grayIndices.length === 0) return out;

  const blackCandidates = palette
    .map((entry, index) => ({ entry, index }))
    .filter(({ index }) => !whiteIndices.has(index))
    .filter(({ entry, index }) => {
      const [r, g, b] = paletteRgbs[index] ?? [255, 255, 255];
      const luma = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
      const name = `${entry.name ?? ''} ${entry.yarnColorName ?? ''}`.toLowerCase();
      return luma <= 46 || hasNameToken(name, ['black', 'charcoal']);
    })
    .map(({ index }) => index);
  const blackIndex = blackCandidates.length > 0
    ? blackCandidates.sort((a, b) => {
        const [ar, ag, ab] = paletteRgbs[a] ?? [255, 255, 255];
        const [br, bg, bb] = paletteRgbs[b] ?? [255, 255, 255];
        const al = (0.2126 * ar) + (0.7152 * ag) + (0.0722 * ab);
        const bl = (0.2126 * br) + (0.7152 * bg) + (0.0722 * bb);
        return al - bl;
      })[0]
    : null;

  const xStart = Math.max(1, Math.floor(width * 0.51));
  const xEnd = Math.min(width - 1, Math.ceil(width * 0.68));
  const yStart = Math.max(1, Math.floor(height * 0.15));
  const yEnd = Math.min(height - 1, Math.ceil(height * 0.36));

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const at = y * width + x;
      if (!whiteIndices.has(out[at])) continue;

      const sourcePixel = sourcePixels[at];
      if (!sourcePixel) continue;
      const [sr, sg, sb] = sourcePixel;
      const sourceAvg = (sr + sg + sb) / 3;
      const sourceSpread = Math.max(sr, sg, sb) - Math.min(sr, sg, sb);
      const nearWhiteSource = isNearWhiteSourcePixel(sourcePixel);
      const sourceSnoutLike =
        isLightCoolSourcePixel(sourcePixel) ||
        isLightPastelNonWhiteSourcePixel(sourcePixel);
      if (!sourceSnoutLike && !nearWhiteSource) continue;
      // Keep very bright pure white highlights; remap tinted muzzle whites.
      if (sourceAvg >= 242 && sourceSpread <= 10) continue;

      let nonWhiteNeighbors = 0;
      let darkNeighbors = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const n = (y + oy) * width + (x + ox);
          if (!whiteIndices.has(out[n])) {
            nonWhiteNeighbors++;
            const rgb = paletteRgbs[out[n]];
            if (rgb) {
              const luma = (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
              if (luma <= 120) darkNeighbors++;
            }
          }
        }
      }

      const coreMuzzleMinX = Math.floor(width * 0.53);
      const coreMuzzleMaxX = Math.ceil(width * 0.69);
      const coreMuzzleMinY = Math.floor(height * 0.18);
      const coreMuzzleMaxY = Math.ceil(height * 0.35);
      const inCoreMuzzle =
        x >= coreMuzzleMinX &&
        x <= coreMuzzleMaxX &&
        y >= coreMuzzleMinY &&
        y <= coreMuzzleMaxY;

      const inInnerMuzzle =
        x >= Math.floor(width * 0.57) &&
        x <= Math.ceil(width * 0.65) &&
        y >= Math.floor(height * 0.22) &&
        y <= Math.ceil(height * 0.31);

      const inUpperSnoutIsland =
        x >= Math.floor(width * 0.59) &&
        x <= Math.ceil(width * 0.71) &&
        y >= Math.floor(height * 0.15) &&
        y <= Math.ceil(height * 0.26);
      const inLowerSnoutIsland =
        x >= Math.floor(width * 0.54) &&
        x <= Math.ceil(width * 0.65) &&
        y >= Math.floor(height * 0.23) &&
        y <= Math.ceil(height * 0.36);

      if ((inUpperSnoutIsland || inLowerSnoutIsland)) {
        const paletteRgb = paletteRgbs[out[at]];
        if (paletteRgb && isNearWhitePaletteEntry(palette[out[at]])) {
          const replacement = chooseBestIndexForSourcePixel(sourcePixel, grayIndices, paletteRgbs);
          if (replacement !== null) {
            out[at] = replacement;
            continue;
          }
        }
      }

      if (inCoreMuzzle && sourceSnoutLike && nonWhiteNeighbors >= 2) {
        const replacement = chooseBestIndexForSourcePixel(sourcePixel, grayIndices, paletteRgbs);
        if (replacement !== null) {
          out[at] = replacement;
          continue;
        }
      }

      if (inInnerMuzzle && nonWhiteNeighbors >= 2) {
        const replacement = chooseBestIndexForSourcePixel(sourcePixel, grayIndices, paletteRgbs);
        if (replacement !== null) {
          out[at] = replacement;
          continue;
        }
      }

      const inNoseBox =
        x >= Math.floor(width * 0.66) &&
        x <= Math.ceil(width * 0.73) &&
        y >= Math.floor(height * 0.15) &&
        y <= Math.ceil(height * 0.24);
      if (inNoseBox && blackIndex !== null) {
        const currentRgb = paletteRgbs[out[at]];
        if (currentRgb) {
          const currentLuma = (0.2126 * currentRgb[0]) + (0.7152 * currentRgb[1]) + (0.0722 * currentRgb[2]);
          if (currentLuma <= 150 && nonWhiteNeighbors >= 2) {
            out[at] = blackIndex;
            continue;
          }
        }
      }

      if (inCoreMuzzle && nonWhiteNeighbors >= 3 && darkNeighbors >= 1) {
        const replacement = chooseBestIndexForSourcePixel(sourcePixel, grayIndices, paletteRgbs);
        if (replacement !== null) {
          out[at] = replacement;
          continue;
        }
      }

      if (nearWhiteSource) {
        if (!inCoreMuzzle || nonWhiteNeighbors < 4 || darkNeighbors < 1) continue;
      } else if (nonWhiteNeighbors < 3 || darkNeighbors < 1) {
        continue;
      }

      const replacement = chooseBestIndexForSourcePixel(sourcePixel, grayIndices, paletteRgbs);
      if (replacement !== null) {
        out[at] = replacement;
      }
    }
  }

  return out;
}

function applyMoonMountainColorLock(opts: {
  indices: number[];
  sourcePixels: RgbPixel[];
  palette: PaletteEntry[];
  width: number;
  height: number;
}): number[] {
  const { indices, sourcePixels, palette, width, height } = opts;
  const out = [...indices];

  const whiteIndices = new Set(
    palette
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => isNearWhitePaletteEntry(entry))
      .map(({ index }) => index),
  );
  if (whiteIndices.size === 0) return out;

  const paletteRgbs = palette.map((entry) => hexToRgb(entry.hex));
  const graySet = new Set(
    paletteRgbs
      .map((rgb, index) => ({ rgb, index }))
      .filter(({ rgb, index }) => {
        if (whiteIndices.has(index)) return false;
        const [r, g, b] = rgb;
        const avg = (r + g + b) / 3;
        return Math.abs(r - g) <= 24 && Math.abs(g - b) <= 24 && avg >= 96 && avg <= 232;
      })
      .map(({ index }) => index),
  );
  if (graySet.size === 0) return out;

  const blueIndices = paletteRgbs
    .map((rgb, index) => ({ rgb, index }))
    .filter(({ rgb, index }) => {
      if (whiteIndices.has(index)) return false;
      return (rgb[2] - rgb[0]) >= 8 && (rgb[2] - rgb[1]) >= 2;
    })
    .map(({ index }) => index);

  const moonMinX = Math.floor(width * 0.18);
  const moonMaxX = Math.ceil(width * 0.9);
  const moonMaxY = Math.ceil(height * 0.48);

  const muzzleMinX = Math.floor(width * 0.51);
  const muzzleMaxX = Math.ceil(width * 0.68);
  const muzzleMinY = Math.floor(height * 0.18);
  const muzzleMaxY = Math.ceil(height * 0.35);

  const mountainMinY = Math.floor(height * 0.34);
  const mountainMaxY = Math.ceil(height * 0.8);
  const mountainSideX = Math.floor(width * 0.36);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x;
      if (!graySet.has(out[at])) continue;

      const sourcePixel = sourcePixels[at];
      if (!sourcePixel) continue;

      const inMoonWindow = x >= moonMinX && x <= moonMaxX && y <= moonMaxY;
      const inMuzzleWindow = x >= muzzleMinX && x <= muzzleMaxX && y >= muzzleMinY && y <= muzzleMaxY;
      if (inMoonWindow) {
        if (inMuzzleWindow) {
          // In the overlap zone, only whiten if the pixel is truly surrounded by moon
          // (mostly white neighbors). Real muzzle pixels have wolf body colors as neighbors.
          let whiteNeighborCount = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              if (ox === 0 && oy === 0) continue;
              const nx = x + ox; const ny = y + oy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              if (whiteIndices.has(out[ny * width + nx])) whiteNeighborCount++;
            }
          }
          if (whiteNeighborCount < 6) continue; // mostly wolf neighbors — keep gray
        }
        const whiteCandidates = Array.from(whiteIndices);
        const replacement = chooseBestIndexForSourcePixel(sourcePixel, whiteCandidates, paletteRgbs);
        if (replacement !== null) {
          out[at] = replacement;
          continue;
        }
      }

      const inMountainWindow =
        (x <= mountainSideX || x >= width - mountainSideX - 1) &&
        y >= mountainMinY &&
        y <= mountainMaxY;
      if (inMountainWindow) {
        const mountainCandidates = [
          ...Array.from(whiteIndices),
          ...blueIndices,
        ];
        const replacement = chooseBestIndexForSourcePixel(sourcePixel, mountainCandidates, paletteRgbs);
        if (replacement !== null) {
          out[at] = replacement;
        }
      }
    }
  }

  return out;
}

function computeDuplicateColorRatio(palette: PaletteEntry[]): number {
  if (palette.length < 2) return 0;

  const rgbs = palette.map((p) => hexToRgb(p.hex));
  let nearDuplicatePairs = 0;
  let allPairs = 0;

  for (let i = 0; i < rgbs.length; i++) {
    for (let j = i + 1; j < rgbs.length; j++) {
      allPairs++;
      if (deltaE76(rgbs[i], rgbs[j]) <= 8) {
        nearDuplicatePairs++;
      }
    }
  }

  return allPairs === 0 ? 0 : nearDuplicatePairs / allPairs;
}

function computeBandFragmentation(
  indices: number[],
  width: number,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
): number {
  const bandWidth = xEnd - xStart;
  const bandHeight = yEnd - yStart;
  if (bandWidth <= 1 || bandHeight <= 0) return 0;

  let transitions = 0;
  let comparisons = 0;

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart + 1; x < xEnd; x++) {
      comparisons++;
      const left = indices[y * width + (x - 1)];
      const current = indices[y * width + x];
      if (left !== current) transitions++;
    }
  }

  return comparisons === 0 ? 0 : transitions / comparisons;
}

function largestComponentRatioForColor(
  indices: number[],
  width: number,
  height: number,
  targetColor: number,
): number {
  const total = indices.reduce((acc, color) => acc + (color === targetColor ? 1 : 0), 0);
  if (total === 0) return 0;

  const visited = new Uint8Array(indices.length);
  const queue = new Int32Array(indices.length);
  let largest = 0;

  for (let i = 0; i < indices.length; i++) {
    if (visited[i] || indices[i] !== targetColor) continue;

    let head = 0;
    let tail = 0;
    let size = 0;
    visited[i] = 1;
    queue[tail++] = i;

    while (head < tail) {
      const at = queue[head++];
      size++;
      const x = at % width;
      const y = Math.floor(at / width);

      const neighbors = [
        y > 0 ? at - width : -1,
        y < height - 1 ? at + width : -1,
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
      ];

      for (const n of neighbors) {
        if (n < 0 || visited[n] || indices[n] !== targetColor) continue;
        visited[n] = 1;
        queue[tail++] = n;
      }
    }

    if (size > largest) largest = size;
  }

  return largest / total;
}

function computePatternQualityMetrics(opts: {
  indices: number[];
  palette: PaletteEntry[];
  width: number;
  height: number;
}): PatternQualityMetrics {
  const { indices, palette, width, height } = opts;

  const topRows = Math.max(4, Math.floor(height * 0.28));
  const bottomRows = Math.max(4, Math.floor(height * 0.22));
  const sideCols = Math.max(3, Math.floor(width * 0.12));

  const topFrag = computeBandFragmentation(indices, width, 0, width, 0, topRows);
  const bottomFrag = computeBandFragmentation(indices, width, 0, width, height - bottomRows, height);
  const leftFrag = computeBandFragmentation(indices, width, 0, sideCols, 0, height);
  const rightFrag = computeBandFragmentation(indices, width, width - sideCols, width, 0, height);
  const flatRegionFragmentation = clamp01((topFrag + bottomFrag + leftFrag + rightFrag) / 4);

  const skyColor = dominantColorInBand(indices, width, 0, width, 0, topRows);
  const treeColor = dominantColorInBand(indices, width, 0, sideCols, 0, height);
  const skyContinuity = largestComponentRatioForColor(indices, width, height, skyColor);
  const treeContinuity = largestComponentRatioForColor(indices, width, height, treeColor);
  const skyTreeContinuityScore = Math.round(((skyContinuity + treeContinuity) / 2) * 100);

  return {
    duplicateColorRatio: clamp01(computeDuplicateColorRatio(palette)),
    flatRegionFragmentation,
    skyTreeContinuityScore,
  };
}

function buildQaFlags(metrics: PatternQualityMetrics, flattenBackgroundRegions: boolean): string[] {
  const flags: string[] = [];

  if (metrics.duplicateColorRatio > 0.2) {
    flags.push('High duplicate-color ratio detected. Similar palette colors may confuse chart reading.');
  }

  if (metrics.flatRegionFragmentation > 0.34) {
    flags.push(
      flattenBackgroundRegions
        ? 'Flat region fragmentation is still high. Consider switching to Graphic/Clean Art mode.'
        : 'Flat region fragmentation is high. Enable Flatten background regions for a cleaner beginner-friendly chart.',
    );
  }

  if (metrics.skyTreeContinuityScore < 65) {
    flags.push('Sky/tree continuity is low. Large background masses may need manual refinement.');
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function quantizeImage(opts: QuantizeOptions): Promise<QuantizeResult> {
  const {
    imageBase64,
    gridWidth,
    gridHeight,
    colorCount,
    brandId,
    selectedYarnColorIds,
    stitchType = 'tapestry',
    yarnWeight = DEFAULT_YARN_WEIGHT,
    renderMode = 'photo-gradient',
    flattenBackgroundRegions = false,
  } = opts;
  const weightConfig = getYarnWeightConfig(yarnWeight);
  const resolvedHookSize = opts.hookSize ?? getDefaultHook(yarnWeight, stitchType);

  // ── Step 1: Decode base64 → Buffer ────────────────────────────────────────
  const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // ── Step 2: Read with Jimp, resize to grid dimensions ────────────────────
  const image = await Jimp.read(buffer);
  image.resize({ w: gridWidth, h: gridHeight, mode: ResizeStrategy.BILINEAR });

  // ── Step 3: Resolve effective color count and adapt low-color images ──────
  const originalPixels = extractRgbPixels(image);

  // ── Step 4: Quantize ──────────────────────────────────────────────────────
  const uniqueSelectedColorIds = selectedYarnColorIds
    ? Array.from(new Set(selectedYarnColorIds))
    : [];
  const selectedColorRecords = uniqueSelectedColorIds
    .map((colorId) => getYarnColorById(colorId))
    .filter((color): color is NonNullable<typeof color> => Boolean(color));
  const resolvedBrandId = brandId ?? selectedColorRecords[0]?.brandId;
  const normalizedSelectedColorIds = selectedColorRecords.length > 0
    ? selectedColorRecords
        .filter((color) => color.brandId === selectedColorRecords[0].brandId)
        .map((color) => color.id)
    : uniqueSelectedColorIds;

  // When colorCount is 0 (auto), count unique colors in the pixelated image, capped at 30
  const AUTO_MAX = 30;
  const uniqueSourceColors = new Set(originalPixels.map(([r, g, b]) => `${r},${g},${b}`)).size;
  const resolvedColorCount = colorCount === 0
    ? Math.min(uniqueSourceColors, AUTO_MAX)
    : colorCount;

  const effectiveColorCount =
    normalizedSelectedColorIds.length > 0
      ? Math.min(resolvedColorCount, normalizedSelectedColorIds.length)
      : resolvedColorCount;

  // Apply style-specific preprocessing before quantization.
  if (renderMode === 'graphic-clean-art') {
    image.normalize();
    image.contrast(effectiveColorCount <= 6 ? 0.28 : 0.2);
    image.posterize(Math.max(6, Math.min(18, effectiveColorCount + 3)));
    image.convolute([
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0],
    ]);
  } else if (colorCount > 0 && effectiveColorCount <= 6) {
    // For photo/gradient mode, keep detail while assisting low-color readability.
    image.normalize();
    image.contrast(effectiveColorCount <= 4 ? 0.22 : 0.12);
    image.convolute([
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0],
    ]);
  }

  const pixels = extractRgbPixels(image);

  const colormap = quantize(pixels, effectiveColorCount);
  const rawPalette: RgbPixel[] = colormap ? colormap.palette() : [[0, 0, 0]];

  // ── Step 5: Build palette entries, optionally snap to yarn colors ─────────
  const palette: PaletteEntry[] = rawPalette.map(([r, g, b], i) => {
    let hex = rgbToHex(r, g, b);
    let name: string | undefined;
    let yarnBrand: string | undefined;
    let yarnColorName: string | undefined;

    if (normalizedSelectedColorIds.length > 0) {
      const matched = findNearestYarnColorFromIds(hex, normalizedSelectedColorIds);
      if (matched) {
        hex           = matched.hex;
        name          = matched.name;
        yarnBrand     = matched.brand;
        yarnColorName = matched.name;
      }
    } else if (resolvedBrandId) {
      const matched = findNearestYarnColor(hex, resolvedBrandId);
      hex           = matched.hex;
      name          = matched.name;
      yarnBrand     = matched.brand;
      yarnColorName = matched.name;
    } else {
      name = getFriendlyColorName(hex);
    }

    return {
      index:     i,
      hex,
      symbol:    String.fromCharCode(65 + i), // A, B, C … L
      pixelCount: 0,                          // filled in step 8
      name,
      yarnBrand,
      yarnColorName,
    };
  });

  // ── Step 6: Preserve quantizer cluster assignments before yarn snapping ───
  // This avoids reassigning large light regions to a white snapped shade solely
  // due to nearest-color distance after palette snapping.
  const initialMapped = mapPixelsToPaletteIndices(pixels, rawPalette);
  const pixelIndices = initialMapped.indices;
  const averageDistance = initialMapped.averageDistance;
  const qualityWarnings: string[] = [];
  const lowColorWarning = buildLowColorWarning({
    requestedColorCount: colorCount,
    effectiveColorCount,
    uniqueSourceColors,
    averageDistance,
  });
  if (lowColorWarning) {
    qualityWarnings.push(lowColorWarning);
  }

  // ── Step 7: Count stitches per palette index ──────────────────────────────
  const counts = countIndices(pixelIndices, palette.length);
  palette.forEach((p, i) => { p.pixelCount = counts[i]; });
  // ── Step 8.5: Deduplicate palette entries with identical yarn matches ─────
  // When multiple quantized colors snap to nearly identical yarn shades, merge.
  const dedupeMap = new Map<number, number>(); // old palette index → new index
  const filteredPalette: PaletteEntry[] = [];
  const perceptualMergeThreshold = normalizedSelectedColorIds.length > 0 ? 4 : 6;
  const tinyColorRegionThreshold = Math.max(8, Math.floor(gridWidth * gridHeight * 0.003));

  for (let i = 0; i < palette.length; i++) {
    const current = palette[i];
    const currentRgb = hexToRgb(current.hex);
    let mergedTo = -1;

    // Check if this color already exists in filteredPalette
    for (let j = 0; j < filteredPalette.length; j++) {
      const existing = filteredPalette[j];
      const existingRgb = hexToRgb(existing.hex);
      const sameHex = current.hex === existing.hex;
      const sameYarn =
        current.yarnBrand === existing.yarnBrand &&
        current.yarnColorName === existing.yarnColorName;
      const perceptuallyVeryClose = deltaE76(currentRgb, existingRgb) <= perceptualMergeThreshold;
      const eitherIsTinyRegion =
        current.pixelCount <= tinyColorRegionThreshold ||
        existing.pixelCount <= tinyColorRegionThreshold;

      if (
        (sameHex && sameYarn) ||
        (sameYarn && current.yarnBrand !== undefined) ||
        (perceptuallyVeryClose && eitherIsTinyRegion)
      ) {
        // Accumulate stitches on the earlier index
        existing.pixelCount += current.pixelCount;
        dedupeMap.set(i, j);
        mergedTo = j;
        break;
      }
    }

    if (mergedTo === -1) {
      // New unique color; add to filteredPalette and update its index/symbol
      current.index = filteredPalette.length;
      current.symbol = String.fromCharCode(65 + filteredPalette.length);
      filteredPalette.push(current);
      dedupeMap.set(i, filteredPalette.length - 1);
    }
  }

  // Remap indices after dedupe and smooth isolated noise in flat areas.
  const remappedPixelIndices = pixelIndices.map((idx) => dedupeMap.get(idx) ?? 0);
  let refinedPixelIndices = applyAdaptiveFlatRegionSmoothing({
    indices: remappedPixelIndices,
    sourcePixels: originalPixels,
    width: gridWidth,
    height: gridHeight,
  });

  if (flattenBackgroundRegions) {
    refinedPixelIndices = applyBackgroundBandFlattening({
      indices: refinedPixelIndices,
      sourcePixels: originalPixels,
      width: gridWidth,
      height: gridHeight,
    });
  }

  if (renderMode === 'graphic-clean-art') {
    refinedPixelIndices = applyAdaptiveFlatRegionSmoothing({
      indices: refinedPixelIndices,
      sourcePixels: originalPixels,
      width: gridWidth,
      height: gridHeight,
    });
  }

  refinedPixelIndices = applyForegroundBackgroundSeparation({
    indices: refinedPixelIndices,
    sourcePixels: originalPixels,
    palette: filteredPalette,
    width: gridWidth,
    height: gridHeight,
  });

  refinedPixelIndices = applyDominantComponentSeparation({
    indices: refinedPixelIndices,
    sourcePixels: originalPixels,
    palette: filteredPalette,
    width: gridWidth,
    height: gridHeight,
  });

  refinedPixelIndices = applyIntraComponentHueRecovery({
    indices: refinedPixelIndices,
    sourcePixels: originalPixels,
    palette: filteredPalette,
    width: gridWidth,
    height: gridHeight,
  });

  refinedPixelIndices = applyInteriorWhiteFallback({
    indices: refinedPixelIndices,
    sourcePixels: originalPixels,
    palette: filteredPalette,
    width: gridWidth,
    height: gridHeight,
  });

  refinedPixelIndices = applyLowerCenterNearWhiteGrayGuard({
    indices: refinedPixelIndices,
    sourcePixels: originalPixels,
    palette: filteredPalette,
    width: gridWidth,
    height: gridHeight,
  });

  refinedPixelIndices = applyMuzzleWhiteGrayOverride({
    indices: refinedPixelIndices,
    sourcePixels: originalPixels,
    palette: filteredPalette,
    width: gridWidth,
    height: gridHeight,
  });

  refinedPixelIndices = applyMoonMountainColorLock({
    indices: refinedPixelIndices,
    sourcePixels: originalPixels,
    palette: filteredPalette,
    width: gridWidth,
    height: gridHeight,
  });

  const finalCounts = countIndices(refinedPixelIndices, filteredPalette.length);
  filteredPalette.forEach((p, i) => {
    p.index = i;
    p.symbol = String.fromCharCode(65 + i);
    p.pixelCount = finalCounts[i] ?? 0;
  });

  const qualityMetrics = computePatternQualityMetrics({
    indices: refinedPixelIndices,
    palette: filteredPalette,
    width: gridWidth,
    height: gridHeight,
  });
  const qaFlags = buildQaFlags(qualityMetrics, flattenBackgroundRegions);
  qualityWarnings.push(...qaFlags);

  const remappedStitchGrid = buildStitchGridFromIndices(refinedPixelIndices, gridWidth, gridHeight);


  // ── Step 9: Compute yarn inventory ───────────────────────────────────────
  const skeinYardage = getSkeinYardage(resolvedBrandId);
  const yardsPerUnit =
    stitchType === 'c2c'          ? weightConfig.c2cYardsPerBlock :
    stitchType === 'knitting'     ? weightConfig.knittingYardsPerStitch :
    stitchType === 'cross-stitch' ? weightConfig.crossStitchYardsPerStitch :
                                    weightConfig.tapestryYardsPerStitch;
  const inventory: YarnInventoryEntry[] = filteredPalette.map((p) => {
    const yardsNeeded  = p.pixelCount * yardsPerUnit * (1 + BUFFER_PERCENT);
    const skeinsNeeded = Math.ceil(yardsNeeded / skeinYardage);
    return {
      paletteIndex:  p.index,
      hex:           p.hex,
      symbol:        p.symbol,
      totalStitches: p.pixelCount,
      yardsNeeded,
      skeinsNeeded,
      yarnBrand:     p.yarnBrand,
      yarnColorName: p.yarnColorName,
    };
  });

  return {
    stitchGrid: remappedStitchGrid,
    palette: filteredPalette,
    dimensions: { width: gridWidth, height: gridHeight },
    inventory,
    aspectRatio: gridWidth / gridHeight,
    stitchType,
    yarnWeight,
    hookSize: resolvedHookSize,
    renderMode,
    flattenBackgroundRegions,
    qualityWarnings,
    qualityMetrics,
    qaFlags,
  };
}
