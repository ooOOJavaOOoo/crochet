#!/usr/bin/env node
/**
 * COMPREHENSIVE RGB ANALYSIS REPORT
 * Compare source colors of white-mapped cells: Snout vs Moon
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

async function main() {
  const wolfPath = path.resolve(__dirname, '../wolf.png');
  console.log(`\nLOADING PATTERN FROM: ${wolfPath}\n`);

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

    // Find white palette indices
    const whiteIndices = new Set<number>();
    for (let i = 0; i < pattern.palette.length; i++) {
      if (isNearWhitePaletteEntry(pattern.palette[i])) {
        whiteIndices.add(i);
      }
    }

    const whiteColor = pattern.palette[Array.from(whiteIndices)[0]];
    console.log(`White Target Color: ${whiteColor.hex} (${whiteColor.yarnColorName})\n`);

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

    // Extract white-mapped cells from each region
    function extractWhiteMappedCells(xStart: number, xEnd: number, yStart: number, yEnd: number) {
      const cells: any[] = [];
      for (let y = yStart; y <= yEnd; y++) {
        for (let x = xStart; x <= xEnd; x++) {
          const paletteIdx = pattern.stitchGrid[y][x];
          if (whiteIndices.has(paletteIdx)) {
            const idx = y * GRID_WIDTH + x;
            const [r, g, b] = sourcePixels[idx];
            cells.push({
              x,
              y,
              r,
              g,
              b,
              minCh: Math.min(r, g, b),
              maxCh: Math.max(r, g, b),
              avg: (r + g + b) / 3,
              gMinusR: g - r,
              bMinusR: b - r,
            });
          }
        }
      }
      return cells;
    }

    const snoutCells = extractWhiteMappedCells(74, 84, 121, 130);
    const moonCells = extractWhiteMappedCells(72, 82, 132, 145);

    function computeStats(cells: any[], name: string) {
      if (cells.length === 0) {
        console.log(`  [NO DATA FOR ${name}]\n`);
        return null;
      }

      // Compute comprehensive stats
      let sumR = 0,
        sumG = 0,
        sumB = 0;
      let sumMin = 0,
        sumGminusR = 0,
        sumBminusR = 0;
      let minMinCh = Infinity,
        maxMinCh = -Infinity;
      let minGminusR = Infinity,
        maxGminusR = -Infinity;
      let minBminusR = Infinity,
        maxBminusR = -Infinity;

      for (const cell of cells) {
        sumR += cell.r;
        sumG += cell.g;
        sumB += cell.b;
        sumMin += cell.minCh;
        sumGminusR += cell.gMinusR;
        sumBminusR += cell.bMinusR;

        minMinCh = Math.min(minMinCh, cell.minCh);
        maxMinCh = Math.max(maxMinCh, cell.minCh);
        minGminusR = Math.min(minGminusR, cell.gMinusR);
        maxGminusR = Math.max(maxGminusR, cell.gMinusR);
        minBminusR = Math.min(minBminusR, cell.bMinusR);
        maxBminusR = Math.max(maxBminusR, cell.bMinusR);
      }

      const count = cells.length;
      return {
        count,
        avgRgb: [sumR / count, sumG / count, sumB / count],
        avgMinCh: sumMin / count,
        avgGminusR: sumGminusR / count,
        avgBminusR: sumBminusR / count,
        rangeMinCh: { min: minMinCh, max: maxMinCh },
        rangeGminusR: { min: minGminusR, max: maxGminusR },
        rangeBminusR: { min: minBminusR, max: maxBminusR },
      };
    }

    console.log('═'.repeat(90));
    console.log('SNOUT STRIP: x=74..84, y=121..130 (cells that map to white in final pattern)');
    console.log('═'.repeat(90));

    const snoutStats = computeStats(snoutCells, 'SNOUT');
    if (snoutStats) {
      console.log(`\nCell Count: ${snoutStats.count}\n`);

      console.log(`Average RGB:          (${snoutStats.avgRgb[0].toFixed(1)}, ${snoutStats.avgRgb[1].toFixed(1)}, ${snoutStats.avgRgb[2].toFixed(1)})`);
      console.log(`Average minChannel:   ${snoutStats.avgMinCh.toFixed(1)}`);
      console.log(`Average G-R:          ${snoutStats.avgGminusR.toFixed(1)}`);
      console.log(`Average B-R:          ${snoutStats.avgBminusR.toFixed(1)}\n`);

      console.log(`minChannel range:     [${snoutStats.rangeMinCh.min}, ${snoutStats.rangeMinCh.max}]`);
      console.log(`G-R range:            [${snoutStats.rangeGminusR.min}, ${snoutStats.rangeGminusR.max}]`);
      console.log(`B-R range:            [${snoutStats.rangeBminusR.min}, ${snoutStats.rangeBminusR.max}]\n`);

      console.log('Sample cells (first 15):');
      for (let i = 0; i < Math.min(15, snoutCells.length); i++) {
        const c = snoutCells[i];
        console.log(
          `  (${c.x.toString().padStart(3)},${c.y.toString().padStart(3)}): RGB(${c.r.toString().padStart(3)},${c.g.toString().padStart(3)},${c.b.toString().padStart(3)}) minCh=${c.minCh.toString().padStart(3)} G-R=${c.gMinusR.toString().padStart(3)} B-R=${c.bMinusR.toString().padStart(3)}`,
        );
      }
    }

    console.log('\n' + '═'.repeat(90));
    console.log('MOON-EDGE: x=72..82, y=132..145 (cells that map to white in final pattern)');
    console.log('═'.repeat(90));

    const moonStats = computeStats(moonCells, 'MOON');
    if (moonStats) {
      console.log(`\nCell Count: ${moonStats.count}\n`);

      console.log(`Average RGB:          (${moonStats.avgRgb[0].toFixed(1)}, ${moonStats.avgRgb[1].toFixed(1)}, ${moonStats.avgRgb[2].toFixed(1)})`);
      console.log(`Average minChannel:   ${moonStats.avgMinCh.toFixed(1)}`);
      console.log(`Average G-R:          ${moonStats.avgGminusR.toFixed(1)}`);
      console.log(`Average B-R:          ${moonStats.avgBminusR.toFixed(1)}\n`);

      console.log(`minChannel range:     [${moonStats.rangeMinCh.min}, ${moonStats.rangeMinCh.max}]`);
      console.log(`G-R range:            [${moonStats.rangeGminusR.min}, ${moonStats.rangeGminusR.max}]`);
      console.log(`B-R range:            [${moonStats.rangeBminusR.min}, ${moonStats.rangeBminusR.max}]\n`);

      console.log('All cells (complete list):');
      for (const c of moonCells) {
        console.log(
          `  (${c.x.toString().padStart(3)},${c.y.toString().padStart(3)}): RGB(${c.r.toString().padStart(3)},${c.g.toString().padStart(3)},${c.b.toString().padStart(3)}) minCh=${c.minCh.toString().padStart(3)} G-R=${c.gMinusR.toString().padStart(3)} B-R=${c.bMinusR.toString().padStart(3)}`,
        );
      }
    }

    if (snoutStats && moonStats) {
      console.log('\n' + '═'.repeat(90));
      console.log('COMPARATIVE ANALYSIS & THRESHOLD RECOMMENDATIONS');
      console.log('═'.repeat(90));

      console.log('\nAVERAGE SOURCE COLORS (for cells mapping to white):');
      console.log(
        `  Snout: RGB(${snoutStats.avgRgb[0].toFixed(1)}, ${snoutStats.avgRgb[1].toFixed(1)}, ${snoutStats.avgRgb[2].toFixed(1)})`,
      );
      console.log(
        `  Moon:  RGB(${moonStats.avgRgb[0].toFixed(1)}, ${moonStats.avgRgb[1].toFixed(1)}, ${moonStats.avgRgb[2].toFixed(1)})`,
      );
      console.log(
        `  Diff:  ΔR=${(moonStats.avgRgb[0] - snoutStats.avgRgb[0]).toFixed(1)}, ΔG=${(moonStats.avgRgb[1] - snoutStats.avgRgb[1]).toFixed(1)}, ΔB=${(moonStats.avgRgb[2] - snoutStats.avgRgb[2]).toFixed(1)}`,
      );

      console.log('\n' + '─'.repeat(90));
      console.log('THRESHOLD 1: Based on minChannel (darkest component)');
      console.log('─'.repeat(90));

      const minChAvg_snout = snoutStats.avgMinCh;
      const minChAvg_moon = moonStats.avgMinCh;
      const minChThreshold = (minChAvg_snout + minChAvg_moon) / 2;

      console.log(`\n  Snout minChannel avg: ${minChAvg_snout.toFixed(1)}`);
      console.log(`  Moon minChannel avg:  ${minChAvg_moon.toFixed(1)}`);
      console.log(`  Separation gap:       ${Math.abs(minChAvg_moon - minChAvg_snout).toFixed(1)}`);
      console.log(
        `  ► Suggested THRESHOLD: minChannel < ${minChThreshold.toFixed(1)} → SNOUT WHITE`,
      );
      console.log(
        `                         minChannel >= ${minChThreshold.toFixed(1)} → MOON WHITE`,
      );
      console.log(
        `  Classification accuracy (assuming this threshold):`,
      );

      let snoutCorrect = 0,
        moonCorrect = 0;
      for (const c of snoutCells) {
        if (c.minCh < minChThreshold) snoutCorrect++;
      }
      for (const c of moonCells) {
        if (c.minCh >= minChThreshold) moonCorrect++;
      }

      console.log(
        `    - Snout: ${snoutCorrect}/${snoutCells.length} correctly classified (${((snoutCorrect / snoutCells.length) * 100).toFixed(1)}%)`,
      );
      console.log(
        `    - Moon:  ${moonCorrect}/${moonCells.length} correctly classified (${((moonCorrect / moonCells.length) * 100).toFixed(1)}%)`,
      );

      console.log('\n' + '─'.repeat(90));
      console.log('THRESHOLD 2: Based on B-R (blue bias)');
      console.log('─'.repeat(90));

      const brAvg_snout = snoutStats.avgBminusR;
      const brAvg_moon = moonStats.avgBminusR;
      const brThreshold = (brAvg_snout + brAvg_moon) / 2;

      console.log(`\n  Snout B-R avg: ${brAvg_snout.toFixed(1)}`);
      console.log(`  Moon B-R avg:  ${brAvg_moon.toFixed(1)}`);
      console.log(`  Separation gap: ${Math.abs(brAvg_moon - brAvg_snout).toFixed(1)}`);
      console.log(
        `  ► Suggested THRESHOLD: B-R < ${brThreshold.toFixed(1)} → SNOUT WHITE`,
      );
      console.log(
        `                         B-R >= ${brThreshold.toFixed(1)} → MOON WHITE`,
      );

      console.log('\n' + '─'.repeat(90));
      console.log('RECOMMENDED IMPLEMENTATION');
      console.log('─'.repeat(90));

      console.log(
        `\nFor best accuracy, use minChannel threshold: ${Math.round(minChThreshold)}`,
      );
      console.log(
        `\nProposed code logic:`,
      );
      console.log(
        `  const minChannel = Math.min(r, g, b);`,
      );
      console.log(
        `  const isSnoutWhite = minChannel < ${Math.round(minChThreshold)};`,
      );
      console.log(
        `  const isMoonWhite = minChannel >= ${Math.round(minChThreshold)};`,
      );
    }

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
