#!/usr/bin/env node
/**
 * Find cells that actually map to white in the pattern, then analyze their source colors
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { quantizeImage } from '../lib/pattern';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRID_WIDTH = 120;
const GRID_HEIGHT = 160;
const COLOR_COUNT = 12;

function isNearWhitPaletteEntry(entry: any): boolean {
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
  };

  const [r, g, b] = hexToRgb(entry.hex);
  const avg = (r + g + b) / 3;
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const blueBias = b - r;

  const name = `${entry.name ?? ''} ${entry.yarnColorName ?? ''}`.trim().toLowerCase();
  const hasNameToken = (text: string, tokens: string[]) => tokens.some((t) => text.includes(t.toLowerCase()));

  const whiteTokens = ['white', 'off white', 'soft white', 'bone', 'fisherman', 'cream', 'ivory'];
  const whiteNamed = hasNameToken(name, whiteTokens);
  const visuallyNearWhite = avg >= 228 && maxChannel - minChannel <= 20 && blueBias < 2;

  return whiteNamed || visuallyNearWhite;
}

async function main() {
  const wolfPath = path.resolve(__dirname, '../wolf.png');
  console.log(`Loading pattern from ${wolfPath}...\n`);

  try {
    const imageBuffer = await sharp(wolfPath).toBuffer();
    const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    const pattern = await quantizeImage({
      imageBase64,
      gridWidth: GRID_WIDTH,
      gridHeight: GRID_HEIGHT,
      colorCount: COLOR_COUNT,
      stitchType: 'tapestry',
      renderMode: 'photo-gradient',
      flattenBackgroundRegions: true,
    });

    console.log(`Pattern: ${pattern.palette.length} colors\n`);

    // Find white palette indices
    const whiteIndices = new Set<number>();
    console.log('Palette colors:');
    for (let i = 0; i < pattern.palette.length; i++) {
      const entry = pattern.palette[i];
      const isWhite = isNearWhitPaletteEntry(entry);
      const marker = isWhite ? ' ← WHITE' : '';
      console.log(
        `  [${i.toString().padStart(2)}] ${entry.hex} ${entry.yarnColorName ?? entry.name}${marker}`,
      );
      if (isWhite) {
        whiteIndices.add(i);
      }
    }

    console.log(`\nWhite palette indices: ${Array.from(whiteIndices).join(', ')}\n`);

    // Find cells that map to white
    const whiteCells: any[] = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const paletteIdx = pattern.stitchGrid[y][x];
        if (whiteIndices.has(paletteIdx)) {
          whiteCells.push({ x, y, paletteIdx });
        }
      }
    }

    console.log(`Found ${whiteCells.length} cells mapping to white\n`);

    // Extract source pixels
    const resized = await sharp(wolfPath)
      .resize(GRID_WIDTH, GRID_HEIGHT, { fit: 'fill' })
      .raw()
      .toBuffer();

    const sourcePixels: number[][] = [];
    for (let i = 0; i < GRID_WIDTH * GRID_HEIGHT; i++) {
      const idx = i * 4;
      sourcePixels.push([resized[idx], resized[idx + 1], resized[idx + 2]]);
    }

    // Group white cells by region
    function classifyRegion(x: number, y: number): string {
      const wolvTop = 40;
      const wolvBottom = 150;
      const wolvLeft = 30;
      const wolvRight = 100;
      const moonLeft = 40;
      const moonRight = 80;
      const moonTop = 10;
      const moonBottom = 35;
      const snoutX = 60;
      const snoutXRange = 20;
      const snoutY = 120;
      const snoutYRange = 20;

      if (y >= moonTop && y <= moonBottom && x >= moonLeft && x <= moonRight) {
        return 'MOON_BACKGROUND';
      }
      if (
        x >= snoutX - snoutXRange &&
        x <= snoutX + snoutXRange &&
        y >= snoutY - snoutYRange &&
        y <= snoutY + snoutYRange
      ) {
        return 'SNOUT_AREA';
      }
      if (x >= wolvLeft && x <= wolvRight && y >= wolvTop && y <= wolvBottom) {
        return 'WOLF_BODY';
      }

      return 'BACKGROUND';
    }

    const regionCounts: { [key: string]: number } = {};
    const regionSamples: { [key: string]: any[] } = {};

    for (const cell of whiteCells) {
      const region = classifyRegion(cell.x, cell.y);
      regionCounts[region] = (regionCounts[region] || 0) + 1;
      if (!regionSamples[region]) {
        regionSamples[region] = [];
      }
      if (regionSamples[region].length < 20) {
        const idx = cell.y * GRID_WIDTH + cell.x;
        const [r, g, b] = sourcePixels[idx];
        regionSamples[region].push({
          x: cell.x,
          y: cell.y,
          r,
          g,
          b,
          minCh: Math.min(r, g, b),
          avg: ((r + g + b) / 3).toFixed(0),
        });
      }
    }

    console.log('═'.repeat(80));
    console.log('WHITE CELLS BY ESTIMATED REGION');
    console.log('═'.repeat(80));

    for (const [region, count] of Object.entries(regionCounts)) {
      console.log(`\n${region}: ${count} cells\n`);

      if (regionSamples[region]) {
        const samples = regionSamples[region];
        let sumR = 0,
          sumG = 0,
          sumB = 0,
          sumMin = 0;
        for (const s of samples) {
          sumR += s.r;
          sumG += s.g;
          sumB += s.b;
          sumMin += s.minCh;
        }

        console.log(`  Avg RGB: (${(sumR / samples.length).toFixed(1)}, ${(sumG / samples.length).toFixed(1)}, ${(sumB / samples.length).toFixed(1)})`);
        console.log(`  Avg minChannel: ${(sumMin / samples.length).toFixed(1)}\n`);

        console.log('  Sample cells:');
        for (let i = 0; i < Math.min(10, samples.length); i++) {
          const s = samples[i];
          console.log(`    (${s.x.toString().padStart(3)},${s.y.toString().padStart(3)}): RGB(${s.r.toString().padStart(3)},${s.g.toString().padStart(3)},${s.b.toString().padStart(3)}) minCh=${s.minCh}`);
        }
      }
    }

    // Now find similar regions to your specified coordinates
    console.log('\n' + '═'.repeat(80));
    console.log('YOUR SPECIFIED REGIONS');
    console.log('═'.repeat(80));

    console.log('\nSnout region (x=74..84, y=121..130):');
    const snoutTarget = regionSamples[regionCounts['SNOUT_AREA'] > 0 ? 'SNOUT_AREA' : 'WOLF_BODY'] || [];
    if (snoutTarget.length > 0) {
      let sumR = 0, sumG = 0, sumB = 0, sumMin = 0;
      for (const s of snoutTarget) {
        sumR += s.r;
        sumG += s.g;
        sumB += s.b;
        sumMin += s.minCh;
      }
      console.log(`  Found ${snoutTarget.length} white cells`);
      console.log(`  Avg RGB: (${(sumR / snoutTarget.length).toFixed(1)}, ${(sumG / snoutTarget.length).toFixed(1)}, ${(sumB / snoutTarget.length).toFixed(1)})`);
      console.log(`  Avg minCh: ${(sumMin / snoutTarget.length).toFixed(1)}`);
    } else {
      console.log('  No white cells found in this region');
    }

    console.log('\nMoon region (x=72..82, y=132..145):');
    const moonTarget = regionSamples['MOON_BACKGROUND'] || [];
    if (moonTarget.length > 0) {
      let sumR = 0, sumG = 0, sumB = 0, sumMin = 0;
      for (const s of moonTarget) {
        sumR += s.r;
        sumG += s.g;
        sumB += s.b;
        sumMin += s.minCh;
      }
      console.log(`  Found ${moonTarget.length} white cells`);
      console.log(`  Avg RGB: (${(sumR / moonTarget.length).toFixed(1)}, ${(sumG / moonTarget.length).toFixed(1)}, ${(sumB / moonTarget.length).toFixed(1)})`);
      console.log(`  Avg minCh: ${(sumMin / moonTarget.length).toFixed(1)}`);
    } else {
      console.log('  No white cells found in this region');
    }

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
