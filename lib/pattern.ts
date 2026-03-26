import Jimp from 'jimp';
import type { PaletteEntry, YarnInventoryEntry } from './types';
import { findNearestYarnColor, getSkeinYardage } from './yarn';

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

const YARDS_PER_STITCH = 0.6;
const BUFFER_PERCENT   = 0.15;

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface QuantizeOptions {
  imageBase64: string;  // data URI or raw base64
  gridWidth: number;    // target stitch columns
  gridHeight: number;   // target stitch rows
  colorCount: number;   // 2–12
  brandId?: string;     // for yarn color snapping
}

export interface QuantizeResult {
  stitchGrid: number[][];                   // [row][col], row 0 = bottom-left
  palette: PaletteEntry[];
  dimensions: { width: number; height: number };
  inventory: YarnInventoryEntry[];
  aspectRatio: number;
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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function quantizeImage(opts: QuantizeOptions): Promise<QuantizeResult> {
  const { imageBase64, gridWidth, gridHeight, colorCount, brandId } = opts;

  // ── Step 1: Decode base64 → Buffer ────────────────────────────────────────
  const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // ── Step 2: Read with Jimp, resize to grid dimensions ────────────────────
  const image = await Jimp.read(buffer);
  image.resize(gridWidth, gridHeight, Jimp.RESIZE_BILINEAR);

  // ── Step 3: Extract flat RGB pixel array from RGBA bitmap ─────────────────
  const { data } = image.bitmap;
  const pixels: RgbPixel[] = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  // ── Step 4: Quantize ──────────────────────────────────────────────────────
  const colormap = quantize(pixels, colorCount);
  const rawPalette: RgbPixel[] = colormap ? colormap.palette() : [[0, 0, 0]];

  // ── Step 5: Build palette entries, optionally snap to yarn colors ─────────
  const palette: PaletteEntry[] = rawPalette.map(([r, g, b], i) => {
    let hex = rgbToHex(r, g, b);
    let yarnBrand: string | undefined;
    let yarnColorName: string | undefined;

    if (brandId) {
      const matched = findNearestYarnColor(hex, brandId);
      hex           = matched.hex;
      yarnBrand     = matched.brand;
      yarnColorName = matched.name;
    }

    return {
      index:     i,
      hex,
      symbol:    String.fromCharCode(65 + i), // A, B, C … L
      pixelCount: 0,                          // filled in step 8
      yarnBrand,
      yarnColorName,
    };
  });

  // ── Step 6: Map every pixel to nearest palette index (RGB Euclidean) ──────
  const paletteRgbs = palette.map((p) => hexToRgb(p.hex));

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
    return idx;
  });

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

  // ── Step 9: Compute yarn inventory ───────────────────────────────────────
  const skeinYardage = getSkeinYardage(brandId);
  const inventory: YarnInventoryEntry[] = palette.map((p) => {
    const yardsNeeded  = p.pixelCount * YARDS_PER_STITCH * (1 + BUFFER_PERCENT);
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
    stitchGrid,
    palette,
    dimensions: { width: gridWidth, height: gridHeight },
    inventory,
    aspectRatio: gridWidth / gridHeight,
  };
}
