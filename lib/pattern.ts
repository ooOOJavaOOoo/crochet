import Jimp from 'jimp';
import type { PaletteEntry, StitchType, YarnInventoryEntry, YarnWeight } from './types';
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
  qualityWarnings: string[];
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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function quantizeImage(opts: QuantizeOptions): Promise<QuantizeResult> {
  const { imageBase64, gridWidth, gridHeight, colorCount, brandId, selectedYarnColorIds, stitchType = 'tapestry', yarnWeight = DEFAULT_YARN_WEIGHT } = opts;
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

  // When users limit colors heavily, boost contrast/edges before quantization
  // so key shapes stay readable with a tiny palette.
  if (colorCount > 0 && effectiveColorCount <= 6) {
    image.normalize();
    image.contrast(effectiveColorCount <= 4 ? 0.25 : 0.15);
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

  let totalDistance = 0;

  const pixelIndices: number[] = pixels.map((px) => {
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

  const averageDistance = pixels.length > 0 ? totalDistance / pixels.length : 0;
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

  // ── Step 7: Build stitchGrid — row 0 = bottom of blanket (flip image) ────
  const stitchGrid: number[][] = Array.from({ length: gridHeight }, (_, gridRow) => {
    const imageRow = gridHeight - 1 - gridRow; // flip: grid[0] = last image row
    return Array.from({ length: gridWidth }, (_, col) => {
      return pixelIndices[imageRow * gridWidth + col];
    });
  });

  // ── Step 8: Count stitches per palette index ──────────────────────────────
  const counts = new Array<number>(palette.length).fill(0);
  for (const idx of pixelIndices) counts[idx]++;
  palette.forEach((p, i) => { p.pixelCount = counts[i]; });
  // ── Step 8.5: Deduplicate palette entries with identical yarn matches ─────
  // When multiple quantized colors snap to the same yarn product, merge them.
  const dedupeMap = new Map<number, number>(); // old palette index → new index
  const filteredPalette: PaletteEntry[] = [];

  for (let i = 0; i < palette.length; i++) {
    const current = palette[i];
    let mergedTo = -1;

    // Check if this color already exists in filteredPalette
    for (let j = 0; j < filteredPalette.length; j++) {
      const existing = filteredPalette[j];
      const sameHex = current.hex === existing.hex;
      const sameYarn =
        current.yarnBrand === existing.yarnBrand &&
        current.yarnColorName === existing.yarnColorName;

      // Merge if both hex and yarn match are the same, or if yarn matches are identical and defined
      if ((sameHex && sameYarn) || (sameYarn && current.yarnBrand !== undefined)) {
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

  // Remap pixelIndices and stitchGrid to use deduplicated palette indices
  const remappedPixelIndices = pixelIndices.map((idx) => dedupeMap.get(idx)!);
  const remappedStitchGrid: number[][] = Array.from({ length: gridHeight }, (_, gridRow) => {
    const imageRow = gridHeight - 1 - gridRow;
    return Array.from({ length: gridWidth }, (_, col) => {
      return remappedPixelIndices[imageRow * gridWidth + col];
    });
  });


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
    qualityWarnings,
  };
}
