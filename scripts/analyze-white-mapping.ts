#!/usr/bin/env node
/**
 * Comprehensive analysis: Find source RGB stats for cells that map to white in final pattern
 * Compare snout whites vs moon whites using the actual pattern generation logic
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

// Exact same classification functions as in pattern.ts
function isNearWhitePaletteEntry(entry: any): boolean {
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

function isMoonLikeSourcePixel(px: number[]): boolean {
  const [r, g, b] = px;
  const avg = (r + g + b) / 3;
  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);
  const spread = maxChannel - minChannel;
  return avg >= 208 && minChannel >= 168 && spread <= 55 && (b - r) <= 20;
}

function isLightCoolSourcePixel(px: number[]): boolean {
  const [r, g, b] = px;
  const avg = (r + g + b) / 3;
  const minChannel = Math.min(r, g, b);
  return avg >= 162 && minChannel >= 98 && (b - r) >= 2;
}

function isLightPastelNonWhiteSourcePixel(px: number[]): boolean {
  const [r, g, b] = px;
  const avg = (r + g + b) / 3;
  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);
  const warmDominance = r - b;
  return avg >= 164 && minChannel >= 100 && maxChannel - minChannel <= 96 && warmDominance < 38;
}

function isSourceSnoutLike(px: number[]): boolean {
  return isLightCoolSourcePixel(px) || isLightPastelNonWhiteSourcePixel(px);
}

function isNearWhiteSourcePixel(px: number[]): boolean {
  const [r, g, b] = px;
  const avg = (r + g + b) / 3;
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const blueBiased = (b - r) >= 2;
  if (blueBiased) return false;
  const balancedChannels = Math.abs(r - g) <= 10 && Math.abs(g - b) <= 10 && Math.abs(r - b) <= 10;
  return avg >= 238 && minChannel >= 230 && maxChannel - minChannel <= 12 && balancedChannels;
}

async function analyzeWhiteMappedCells(
  sourcePixels: number[][],
  gridWidth: number,
  gridHeight: number,
  paletteIndices: number[],
  palette: any[],
  regionName: string,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
) {
  // Find white indices in palette
  const whiteIndices = new Set<number>();

  for (let i = 0; i < palette.length; i++) {
    if (isNearWhitePaletteEntry(palette[i])) {
      whiteIndices.add(i);
    }
  }

  console.log(`  White palette indices: ${Array.from(whiteIndices).join(', ')}\n`);

  // Find cells in region that are mapped to white
  const whiteMappedCells: any[] = [];
  const allCells: any[] = [];

  for (let y = yStart; y <= yEnd; y++) {
    for (let x = xStart; x <= xEnd; x++) {
      const idx = y * gridWidth + x;
      const sourcePixel = sourcePixels[idx];
      const paletteIdx = paletteIndices[idx];

      if (!sourcePixel) continue;

      const cellData = {
        x,
        y,
        r: sourcePixel[0],
        g: sourcePixel[1],
        b: sourcePixel[2],
        paletteIdx,
        isWhiteTarget: whiteIndices.has(paletteIdx),
      };

      allCells.push(cellData);

      if (whiteIndices.has(paletteIdx)) {
        const isMoon = isMoonLikeSourcePixel(sourcePixel);
        const isSnout = isSourceSnoutLike(sourcePixel);
        const isNearWhite = isNearWhiteSourcePixel(sourcePixel);

        whiteMappedCells.push({
          ...cellData,
          isMoonLike: isMoon,
          isSnoutLike: isSnout,
          isNearWhite: isNearWhite,
        });
      }
    }
  }

  console.log(`Total cells in region: ${allCells.length}`);
  console.log(`Cells mapped to white: ${whiteMappedCells.length}\n`);

  if (whiteMappedCells.length === 0) {
    console.log('  No cells in this region map to white target colors.\n');
    return null;
  }

  // Compute stats for white-mapped cells
  let sumR = 0,
    sumG = 0,
    sumB = 0;
  let sumGminusR = 0,
    sumBminusR = 0;
  let minChannelSum = 0;
  let moonLikeCount = 0,
    snoutLikeCount = 0,
    nearWhiteCount = 0;

  for (const cell of whiteMappedCells) {
    sumR += cell.r;
    sumG += cell.g;
    sumB += cell.b;
    sumGminusR += cell.g - cell.r;
    sumBminusR += cell.b - cell.r;
    minChannelSum += Math.min(cell.r, cell.g, cell.b);

    if (cell.isMoonLike) moonLikeCount++;
    if (cell.isSnoutLike) snoutLikeCount++;
    if (cell.isNearWhite) nearWhiteCount++;
  }

  const count = whiteMappedCells.length;
  const stats = {
    avgRgb: [
      (sumR / count).toFixed(1),
      (sumG / count).toFixed(1),
      (sumB / count).toFixed(1),
    ],
    avgGMinusR: (sumGminusR / count).toFixed(1),
    avgBMinusR: (sumBminusR / count).toFixed(1),
    avgMinChannel: (minChannelSum / count).toFixed(1),
  };

  return {
    regionName,
    cellCount: count,
    stats,
    classification: {
      moonLikeCount,
      snoutLikeCount,
      nearWhiteCount,
    },
    sampleCells: whiteMappedCells.slice(0, 15),
    allCells: whiteMappedCells,
  };
}

async function main() {
  const wolfPath = path.resolve(__dirname, '../wolf.png');
  console.log(`Loading and analyzing ${wolfPath}...\n`);

  try {
    const imageBuffer = await sharp(wolfPath).toBuffer();
    const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    console.log('Generating pattern...');
    const pattern = await quantizeImage({
      imageBase64,
      gridWidth: GRID_WIDTH,
      gridHeight: GRID_HEIGHT,
      colorCount: COLOR_COUNT,
      stitchType: 'tapestry',
      renderMode: 'photo-gradient',
      flattenBackgroundRegions: true,
    });

    console.log(`Pattern generated: ${pattern.palette.length} colors`);
    console.log(`Grid: ${pattern.dimensions.width} x ${pattern.dimensions.height}\n`);

    // Extract source pixels from resized image
    const resized = await sharp(wolfPath)
      .resize(GRID_WIDTH, GRID_HEIGHT, { fit: 'fill' })
      .raw()
      .toBuffer();

    const sourcePixels: number[][] = [];
    for (let i = 0; i < GRID_WIDTH * GRID_HEIGHT; i++) {
      const idx = i * 4;
      sourcePixels.push([resized[idx], resized[idx + 1], resized[idx + 2]]);
    }

    // Map stitchGrid to flat indices
    const paletteIndices: number[] = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const row = GRID_HEIGHT - 1 - y;
        paletteIndices.push(pattern.stitchGrid[row][x]);
      }
    }

    console.log('═'.repeat(80));
    console.log('SNOUT STRIP ANALYSIS (cells render as white)');
    console.log('═'.repeat(80));

    const snoutResult = await analyzeWhiteMappedCells(
      sourcePixels,
      GRID_WIDTH,
      GRID_HEIGHT,
      paletteIndices,
      pattern.palette,
      'Snout Strip',
      74,
      84,
      121,
      130,
    );

    if (snoutResult) {
      console.log(`Region: x=74..84, y=121..130, mapping to white\n`);
      console.log('Source pixel stats:');
      console.log(`  Avg RGB:        [${snoutResult.stats.avgRgb.join(', ')}]`);
      console.log(`  Avg (G-R):      ${snoutResult.stats.avgGMinusR}`);
      console.log(`  Avg (B-R):      ${snoutResult.stats.avgBMinusR}`);
      console.log(`  Avg minChannel: ${snoutResult.stats.avgMinChannel}\n`);

      console.log('Source classification:');
      console.log(
        `  Moon-like:      ${snoutResult.classification.moonLikeCount} (${((snoutResult.classification.moonLikeCount / snoutResult.cellCount) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  Snout-like:     ${snoutResult.classification.snoutLikeCount} (${((snoutResult.classification.snoutLikeCount / snoutResult.cellCount) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  Near-white:     ${snoutResult.classification.nearWhiteCount} (${((snoutResult.classification.nearWhiteCount / snoutResult.cellCount) * 100).toFixed(1)}%)\n`,
      );

      console.log('Sample cells:');
      for (let i = 0; i < Math.min(10, snoutResult.sampleCells.length); i++) {
        const c = snoutResult.sampleCells[i];
        console.log(
          `  (${c.x.toString().padStart(3)},${c.y.toString().padStart(3)}): RGB(${c.r.toString().padStart(3)},${c.g.toString().padStart(3)},${c.b.toString().padStart(3)}) moon=${c.isMoonLike} snout=${c.isSnoutLike} nearW=${c.isNearWhite}`,
        );
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('MOON-EDGE ANALYSIS (cells render as white)');
    console.log('═'.repeat(80));

    const moonResult = await analyzeWhiteMappedCells(
      sourcePixels,
      GRID_WIDTH,
      GRID_HEIGHT,
      paletteIndices,
      pattern.palette,
      'Moon-Edge',
      72,
      82,
      132,
      145,
    );

    if (moonResult) {
      console.log(`Region: x=72..82, y=132..145, mapping to white\n`);
      console.log('Source pixel stats:');
      console.log(`  Avg RGB:        [${moonResult.stats.avgRgb.join(', ')}]`);
      console.log(`  Avg (G-R):      ${moonResult.stats.avgGMinusR}`);
      console.log(`  Avg (B-R):      ${moonResult.stats.avgBMinusR}`);
      console.log(`  Avg minChannel: ${moonResult.stats.avgMinChannel}\n`);

      console.log('Source classification:');
      console.log(
        `  Moon-like:      ${moonResult.classification.moonLikeCount} (${((moonResult.classification.moonLikeCount / moonResult.cellCount) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  Snout-like:     ${moonResult.classification.snoutLikeCount} (${((moonResult.classification.snoutLikeCount / moonResult.cellCount) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  Near-white:     ${moonResult.classification.nearWhiteCount} (${((moonResult.classification.nearWhiteCount / moonResult.cellCount) * 100).toFixed(1)}%)\n`,
      );

      console.log('Sample cells:');
      for (let i = 0; i < Math.min(10, moonResult.sampleCells.length); i++) {
        const c = moonResult.sampleCells[i];
        console.log(
          `  (${c.x.toString().padStart(3)},${c.y.toString().padStart(3)}): RGB(${c.r.toString().padStart(3)},${c.g.toString().padStart(3)},${c.b.toString().padStart(3)}) moon=${c.isMoonLike} snout=${c.isSnoutLike} nearW=${c.isNearWhite}`,
        );
      }
    }

    if (snoutResult && moonResult) {
      console.log('\n' + '═'.repeat(80));
      console.log('COMPARATIVE ANALYSIS');
      console.log('═'.repeat(80));

      const snoutAvgRgb = snoutResult.stats.avgRgb.map(Number);
      const moonAvgRgb = moonResult.stats.avgRgb.map(Number);

      console.log('\nAverage RGB of source pixels that map to white:');
      console.log(
        `  Snout: RGB(${snoutAvgRgb
          .map((v) => v.toFixed(1))
          .join(', ')})`,
      );
      console.log(
        `  Moon:  RGB(${moonAvgRgb
          .map((v) => v.toFixed(1))
          .join(', ')})`,
      );
      console.log(
        `  Diff:  ΔR=${(moonAvgRgb[0] - snoutAvgRgb[0]).toFixed(1)}, ΔG=${(moonAvgRgb[1] - snoutAvgRgb[1]).toFixed(1)}, ΔB=${(moonAvgRgb[2] - snoutAvgRgb[2]).toFixed(1)}`,
      );

      console.log('\nColor characteristics:');
      console.log(`  Snout G-R: ${snoutResult.stats.avgGMinusR}, Moon G-R: ${moonResult.stats.avgGMinusR}`);
      console.log(`  Snout B-R: ${snoutResult.stats.avgBMinusR}, Moon B-R: ${moonResult.stats.avgBMinusR}`);
      console.log(`  Snout minCh: ${snoutResult.stats.avgMinChannel}, Moon minCh: ${moonResult.stats.avgMinChannel}`);

      const snoutMinCh = parseFloat(snoutResult.stats.avgMinChannel);
      const moonMinCh = parseFloat(moonResult.stats.avgMinChannel);
      const suggestedThreshold = ((snoutMinCh + moonMinCh) / 2).toFixed(0);

      console.log('\n' + '─'.repeat(80));
      console.log('THRESHOLD RECOMMENDATIONS');
      console.log('─'.repeat(80));

      console.log(`\nBased on minChannel (darkest RGB component):`);
      console.log(`  Snout avg minChannel:  ${snoutMinCh.toFixed(1)}`);
      console.log(`  Moon avg minChannel:   ${moonMinCh.toFixed(1)}`);
      console.log(`  Midpoint threshold:    ${suggestedThreshold}`);
      console.log(`\n  Rule: If source minChannel < ${suggestedThreshold} → likely SNOUT white`);
      console.log(`  Rule: If source minChannel >= ${suggestedThreshold} → likely MOON white`);

      const bMinusR_snout = parseFloat(snoutResult.stats.avgBMinusR);
      const bMinusR_moon = parseFloat(moonResult.stats.avgBMinusR);
      const bMinusRThreshold = ((bMinusR_snout + bMinusR_moon) / 2).toFixed(1);

      console.log(`\nAlternative: Based on B-R (blue bias):`);
      console.log(`  Snout avg B-R: ${bMinusR_snout.toFixed(1)}`);
      console.log(`  Moon avg B-R:  ${bMinusR_moon.toFixed(1)}`);
      console.log(`  Midpoint threshold: ${bMinusRThreshold}`);
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
