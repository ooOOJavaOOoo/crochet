#!/usr/bin/env node
/**
 * Debug visualization: mark the specified stitchGrid regions on wolf.png
 * and check their actual colors.
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRID_WIDTH = 120;
const GRID_HEIGHT = 160;

async function main() {
  const wolfPath = path.resolve(__dirname, '../wolf.png');
  console.log(`Loading ${wolfPath}...`);

  try {
    const metadata = await sharp(wolfPath).metadata();
    const origWidth = metadata.width;
    const origHeight = metadata.height;
    
    console.log(`Original image: ${origWidth}x${origHeight}`);
    console.log(`Grid size: ${GRID_WIDTH}x${GRID_HEIGHT}`);
    console.log(`Scale factor: ${(origWidth / GRID_WIDTH).toFixed(2)}x${(origHeight / GRID_HEIGHT).toFixed(2)}\n`);

    // Regions to visualize
    const regions = [
      {
        name: 'Snout Strip',
        x: [74, 84],
        y: [121, 130],
      },
      {
        name: 'Moon-Edge',
        x: [72, 82],
        y: [132, 145],
      },
    ];

    // Resize image to grid size to get the actual colors used in pattern
    const resizedBuffer = await sharp(wolfPath)
      .resize(GRID_WIDTH, GRID_HEIGHT, { fit: 'fill' })
      .raw()
      .toBuffer();

    console.log('═'.repeat(80));
    console.log('RESIZED IMAGE ANALYSIS (at grid resolution)');
    console.log('═'.repeat(80));

    for (const region of regions) {
      console.log(`\n${region.name}: x=(${region.x[0]}-${region.x[1]}), y=(${region.y[0]}-${region.y[1]})\n`);

      let samples = [];
      for (let y = region.y[0]; y <= region.y[1]; y++) {
        for (let x = region.x[0]; x <= region.x[1]; x++) {
          const idx = (y * GRID_WIDTH + x) * 4;
          const r = resizedBuffer[idx];
          const g = resizedBuffer[idx + 1];
          const b = resizedBuffer[idx + 2];
          const a = resizedBuffer[idx + 3];
          samples.push({ x, y, r, g, b, a });
        }
      }

      // Compute stats
      let sumR = 0, sumG = 0, sumB = 0;
      let sumGminusR = 0, sumBminusR = 0;
      let minChannelSum = 0;

      for (const s of samples) {
        sumR += s.r;
        sumG += s.g;
        sumB += s.b;
        sumGminusR += (s.g - s.r);
        sumBminusR += (s.b - s.r);
        minChannelSum += Math.min(s.r, s.g, s.b);
      }

      const avgRgb = [
        (sumR / samples.length).toFixed(1),
        (sumG / samples.length).toFixed(1),
        (sumB / samples.length).toFixed(1),
      ];

      console.log(`Stats for ${samples.length} cells:`);
      console.log(`  Avg RGB:        [${avgRgb.join(', ')}]`);
      console.log(`  Avg (G-R):      ${(sumGminusR / samples.length).toFixed(1)}`);
      console.log(`  Avg (B-R):      ${(sumBminusR / samples.length).toFixed(1)}`);
      console.log(`  Avg minChannel: ${(minChannelSum / samples.length).toFixed(1)}`);

      // Show sample cells
      console.log(`\nFirst 10 cells:`);
      for (let i = 0; i < Math.min(10, samples.length); i++) {
        const s = samples[i];
        const min = Math.min(s.r, s.g, s.b);
        console.log(`  (${s.x.toString().padStart(3)},${s.y.toString().padStart(3)}): RGB(${s.r.toString().padStart(3)},${s.g.toString().padStart(3)},${s.b.toString().padStart(3)}) minCh=${min}`);
      }
    }

    // Also check what's at specific coordinates
    console.log('\n' + '═'.repeat(80));
    console.log('DIRECTIONAL SCAN: Check cells nearby for white pixels');
    console.log('═'.repeat(80));

    const centerX = 74;
    const centerY = 121;
    console.log(`\nScanning around (${centerX}, ${centerY}):\n`);

    // Scan up from snout region to find where white starts
    for (let y = 121; y >= 100; y -= 5) {
      const idx = (y * GRID_WIDTH + centerX) * 4;
      const r = resizedBuffer[idx];
      const g = resizedBuffer[idx + 1];
      const b = resizedBuffer[idx + 2];
      const avg = ((r + g + b) / 3).toFixed(0);
      const min = Math.min(r, g, b);
      const isEstimatedWhite = avg >= 208 && min >= 168; // isMoonLike threshold
      console.log(`  y=${y.toString().padStart(3)}: RGB(${r.toString().padStart(3)},${g.toString().padStart(3)},${b.toString().padStart(3)}) avg=${avg} minCh=${min} moon=${isEstimatedWhite}`);
    }

    // Create a visualization image showing the regions
    console.log('\n' + '─'.repeat(80));
    console.log('Creating visualization...');

    // Draw rectangles on resized version
    let image = sharp(wolfPath)
      .resize(GRID_WIDTH * 2, GRID_HEIGHT * 2, { fit: 'fill' })
      .toBuffer();

    // SVG overlay for regions
    const svgOverlay = `
      <svg width="${GRID_WIDTH * 2}" height="${GRID_HEIGHT * 2}">
        <!-- Snout region -->
        <rect x="${74 * 2}" y="${121 * 2}" width="${(84-74) * 2}" height="${(130-121) * 2}" 
              fill="none" stroke="red" stroke-width="2"/>
        <text x="${74 * 2}" y="${121 * 2 - 5}" fill="red" font-size="12" font-weight="bold">Snout</text>
        
        <!-- Moon region -->
        <rect x="${72 * 2}" y="${132 * 2}" width="${(82-72) * 2}" height="${(145-132) * 2}" 
              fill="none" stroke="blue" stroke-width="2"/>
        <text x="${72 * 2}" y="${132 * 2 - 5}" fill="blue" font-size="12" font-weight="bold">Moon</text>
      </svg>
    `;

    const vizPath = path.resolve(__dirname, '../fixtures/wolf-regions-debug.png');
    await sharp(wolfPath)
      .resize(GRID_WIDTH * 2, GRID_HEIGHT * 2, { fit: 'fill' })
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .png()
      .toFile(vizPath);

    console.log(`Visualization saved to: ${vizPath}`);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
