import Jimp from 'jimp';
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

function extractRgbPixels(image: Jimp): RgbPixel[] {
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
  image.resize(gridWidth, gridHeight, Jimp.RESIZE_BILINEAR);

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

  // ── Step 6: Map every pixel to nearest palette index (RGB Euclidean) ──────
  const paletteRgbs = palette.map((p) => hexToRgb(p.hex));
  const initialMapped = mapPixelsToPaletteIndices(pixels, paletteRgbs);
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

      if ((sameHex && sameYarn) || (sameYarn && current.yarnBrand !== undefined) || perceptuallyVeryClose) {
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
  const yardsPerUnit = stitchType === 'c2c' ? weightConfig.c2cYardsPerBlock : weightConfig.tapestryYardsPerStitch;
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
