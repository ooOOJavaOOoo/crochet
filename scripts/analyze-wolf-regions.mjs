#!/usr/bin/env node
/**
 * Analyze RGB statistics from wolf.png in two regions:
 * 1. Snout strip: x=74..84, y=121..130
 * 2. Moon-edge: x=72..82, y=132..145
 * 
 * Identifies classification thresholds to separate snout whites from moon whites.
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Classification functions
function isMoonLikeSourcePixel(r, g, b) {
  const avg = (r + g + b) / 3;
  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);
  const spread = maxChannel - minChannel;
  return avg >= 208 && minChannel >= 168 && spread <= 55 && (b - r) <= 20;
}

function isLightCoolSourcePixel(r, g, b) {
  const avg = (r + g + b) / 3;
  const minChannel = Math.min(r, g, b);
  return avg >= 162 && minChannel >= 98 && (b - r) >= 2;
}

function isLightPastelNonWhiteSourcePixel(r, g, b) {
  const avg = (r + g + b) / 3;
  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);
  const warmDominance = r - b;
  return avg >= 164 && minChannel >= 100 && (maxChannel - minChannel) <= 96 && warmDominance < 38;
}

function isSourceSnoutLike(r, g, b) {
  return isLightCoolSourcePixel(r, g, b) || isLightPastelNonWhiteSourcePixel(r, g, b);
}

function isNearWhiteSourcePixel(r, g, b) {
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

async function analyzeRegion(imageBuffer, width, regionName, xStart, xEnd, yStart, yEnd) {
  const pixels = [];
  
  // Extract raw pixel data
  for (let y = yStart; y <= yEnd; y++) {
    for (let x = xStart; x <= xEnd; x++) {
      const idx = (y * width + x) * 4; // RGBA
      pixels.push({
        x,
        y,
        r: imageBuffer[idx],
        g: imageBuffer[idx + 1],
        b: imageBuffer[idx + 2],
        a: imageBuffer[idx + 3],
      });
    }
  }

  // Compute statistics
  let sumR = 0, sumG = 0, sumB = 0;
  let sumGMinusR = 0, sumBMinusR = 0;
  let sumMinChannel = 0;
  let moonLikeCount = 0, snoutLikeCount = 0, whiteCount = 0;
  let whiteAndMoonCount = 0, whiteAndSnoutCount = 0;

  const pixelClassifications = [];

  for (const px of pixels) {
    const { r, g, b } = px;
    sumR += r;
    sumG += g;
    sumB += b;
    sumGMinusR += (g - r);
    sumBMinusR += (b - r);
    
    const minCh = Math.min(r, g, b);
    sumMinChannel += minCh;

    const isMoon = isMoonLikeSourcePixel(r, g, b);
    const isSnout = isSourceSnoutLike(r, g, b);
    const isWhite = isNearWhiteSourcePixel(r, g, b);

    if (isMoon) moonLikeCount++;
    if (isSnout) snoutLikeCount++;
    if (isWhite) whiteCount++;
    if (isWhite && isMoon) whiteAndMoonCount++;
    if (isWhite && isSnout) whiteAndSnoutCount++;

    pixelClassifications.push({
      x: px.x,
      y: px.y,
      r, g, b,
      minChannel: minCh,
      isMoonLike: isMoon,
      isSnoutLike: isSnout,
      isWhite,
    });
  }

  const count = pixels.length;
  const avgRgb = [sumR / count, sumG / count, sumB / count].map(v => v.toFixed(1));
  const avgGMinusR = (sumGMinusR / count).toFixed(1);
  const avgBMinusR = (sumBMinusR / count).toFixed(1);
  const avgMinChannel = (sumMinChannel / count).toFixed(1);

  return {
    regionName,
    bounds: { xStart, xEnd, yStart, yEnd },
    pixelCount: count,
    stats: {
      avgRgb: `[${avgRgb.join(', ')}]`,
      avgGMinusR,
      avgBMinusR,
      avgMinChannel,
    },
    classification: {
      moonLikeCount,
      snoutLikeCount,
      whiteCount,
      whiteAndMoonCount,
      whiteAndSnoutCount,
    },
    pixelDetails: pixelClassifications,
  };
}

async function main() {
  const wolfsPath = path.resolve(__dirname, '../wolf.png');
  console.log(`Loading ${wolfsPath}...`);

  try {
    const metadata = await sharp(wolfsPath).metadata();
    console.log(`Image: ${metadata.width}x${metadata.height} (${metadata.format})\n`);

    const raw = await sharp(wolfsPath)
      .raw()
      .toBuffer();

    // Regions to analyze
    const snoutRegion = {
      name: 'Snout Strip',
      xStart: 74,
      xEnd: 84,
      yStart: 121,
      yEnd: 130,
    };

    const moonEdgeRegion = {
      name: 'Moon-Edge',
      xStart: 72,
      xEnd: 82,
      yStart: 132,
      yEnd: 145,
    };

    console.log('Analyzing regions...\n');
    const snoutResult = await analyzeRegion(raw, metadata.width, snoutRegion.name, snoutRegion.xStart, snoutRegion.xEnd, snoutRegion.yStart, snoutRegion.yEnd);
    const moonResult = await analyzeRegion(raw, metadata.width, moonEdgeRegion.name, moonEdgeRegion.xStart, moonEdgeRegion.xEnd, moonEdgeRegion.yStart, moonEdgeRegion.yEnd);

    // Print results
    console.log('═'.repeat(80));
    console.log('SNOUT STRIP ANALYSIS');
    console.log('═'.repeat(80));
    console.log(`Region: x=${snoutRegion.xStart}..${snoutRegion.xEnd}, y=${snoutRegion.yStart}..${snoutRegion.yEnd}`);
    console.log(`Total pixels: ${snoutResult.pixelCount}\n`);
    console.log('Statistics:');
    console.log(`  Avg RGB:          ${snoutResult.stats.avgRgb}`);
    console.log(`  Avg (G - R):      ${snoutResult.stats.avgGMinusR}`);
    console.log(`  Avg (B - R):      ${snoutResult.stats.avgBMinusR}`);
    console.log(`  Avg minChannel:   ${snoutResult.stats.avgMinChannel}\n`);
    console.log('Classification counts:');
    console.log(`  Moon-like pixels:           ${snoutResult.classification.moonLikeCount}`);
    console.log(`  Snout-like pixels:          ${snoutResult.classification.snoutLikeCount}`);
    console.log(`  White-like pixels:          ${snoutResult.classification.whiteCount}`);
    console.log(`  White AND Moon-like:        ${snoutResult.classification.whiteAndMoonCount}`);
    console.log(`  White AND Snout-like:       ${snoutResult.classification.whiteAndSnoutCount}\n`);

    // List first 10 white-ish pixels for snout region
    const whiteSnoutPixels = snoutResult.pixelDetails.filter(p => p.isWhite).slice(0, 10);
    if (whiteSnoutPixels.length > 0) {
      console.log('Sample white-like pixels from snout region:');
      whiteSnoutPixels.forEach((p, i) => {
        console.log(`  [${i+1}] (${p.x},${p.y}): RGB(${p.r},${p.g},${p.b}) | G-R=${p.g-p.r}, B-R=${p.b-p.r}, minCh=${p.minChannel} | isMoonLike=${p.isMoonLike}, isSnoutLike=${p.isSnoutLike}`);
      });
    }

    console.log('\n' + '═'.repeat(80));
    console.log('MOON-EDGE ANALYSIS');
    console.log('═'.repeat(80));
    console.log(`Region: x=${moonEdgeRegion.xStart}..${moonEdgeRegion.xEnd}, y=${moonEdgeRegion.yStart}..${moonEdgeRegion.yEnd}`);
    console.log(`Total pixels: ${moonResult.pixelCount}\n`);
    console.log('Statistics:');
    console.log(`  Avg RGB:          ${moonResult.stats.avgRgb}`);
    console.log(`  Avg (G - R):      ${moonResult.stats.avgGMinusR}`);
    console.log(`  Avg (B - R):      ${moonResult.stats.avgBMinusR}`);
    console.log(`  Avg minChannel:   ${moonResult.stats.avgMinChannel}\n`);
    console.log('Classification counts:');
    console.log(`  Moon-like pixels:           ${moonResult.classification.moonLikeCount}`);
    console.log(`  Snout-like pixels:          ${moonResult.classification.snoutLikeCount}`);
    console.log(`  White-like pixels:          ${moonResult.classification.whiteCount}`);
    console.log(`  White AND Moon-like:        ${moonResult.classification.whiteAndMoonCount}`);
    console.log(`  White AND Snout-like:       ${moonResult.classification.whiteAndSnoutCount}\n`);

    // List first 10 white-ish pixels for moon region
    const whiteMoonPixels = moonResult.pixelDetails.filter(p => p.isWhite).slice(0, 10);
    if (whiteMoonPixels.length > 0) {
      console.log('Sample white-like pixels from moon-edge region:');
      whiteMoonPixels.forEach((p, i) => {
        console.log(`  [${i+1}] (${p.x},${p.y}): RGB(${p.r},${p.g},${p.b}) | G-R=${p.g-p.r}, B-R=${p.b-p.r}, minCh=${p.minChannel} | isMoonLike=${p.isMoonLike}, isSnoutLike=${p.isSnoutLike}`);
      });
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPARISON & THRESHOLD ANALYSIS');
    console.log('═'.repeat(80));

    // Compare statistics
    const snoutAvgRgb = snoutResult.stats.avgRgb.slice(1, -1).split(', ').map(Number);
    const moonAvgRgb = moonResult.stats.avgRgb.slice(1, -1).split(', ').map(Number);

    console.log('\nAverage RGB comparison:');
    console.log(`  Snout: RGB(${snoutAvgRgb.map(v => v.toFixed(1)).join(', ')})`);
    console.log(`  Moon:  RGB(${moonAvgRgb.map(v => v.toFixed(1)).join(', ')})`);
    console.log(`  Diff:  ΔR=${(moonAvgRgb[0] - snoutAvgRgb[0]).toFixed(1)}, ΔG=${(moonAvgRgb[1] - snoutAvgRgb[1]).toFixed(1)}, ΔB=${(moonAvgRgb[2] - snoutAvgRgb[2]).toFixed(1)}`);

    console.log('\nColor bias comparison (G-R, B-R):');
    console.log(`  Snout: G-R=${snoutResult.stats.avgGMinusR}, B-R=${snoutResult.stats.avgBMinusR}`);
    console.log(`  Moon:  G-R=${moonResult.stats.avgGMinusR}, B-R=${moonResult.stats.avgBMinusR}`);

    console.log('\nMinChannel (darkest component) comparison:');
    console.log(`  Snout: ${snoutResult.stats.avgMinChannel}`);
    console.log(`  Moon:  ${moonResult.stats.avgMinChannel}`);

    console.log('\nClassification rates (% of pixels):');
    const snoutMoonPct = ((snoutResult.classification.moonLikeCount / snoutResult.pixelCount) * 100).toFixed(1);
    const moonMoonPct = ((moonResult.classification.moonLikeCount / moonResult.pixelCount) * 100).toFixed(1);
    const snoutSnoutPct = ((snoutResult.classification.snoutLikeCount / snoutResult.pixelCount) * 100).toFixed(1);
    const moonSnoutPct = ((moonResult.classification.snoutLikeCount / moonResult.pixelCount) * 100).toFixed(1);

    console.log(`  Moon-like:  Snout=${snoutMoonPct}%, Moon=${moonMoonPct}%`);
    console.log(`  Snout-like: Snout=${snoutSnoutPct}%, Moon=${moonSnoutPct}%`);

    console.log('\n' + '─'.repeat(80));
    console.log('THRESHOLD RECOMMENDATIONS');
    console.log('─'.repeat(80));

    // Analyze which classification functions work best
    console.log('\nObservations:');
    if (snoutResult.classification.whiteCount > 0) {
      const snoutWhiteClass = ((snoutResult.classification.whiteAndMoonCount + snoutResult.classification.whiteAndSnoutCount) / snoutResult.classification.whiteCount * 100).toFixed(1);
      console.log(`  • ${snoutWhiteClass}% of white-like pixels in snout are classified (Moon or Snout)`);
    }
    if (moonResult.classification.whiteCount > 0) {
      const moonWhiteClass = ((moonResult.classification.whiteAndMoonCount + moonResult.classification.whiteAndSnoutCount) / moonResult.classification.whiteCount * 100).toFixed(1);
      console.log(`  • ${moonWhiteClass}% of white-like pixels in moon are classified (Moon or Snout)`);
    }

    console.log(`  • Snout region: Moon-like=${snoutMoonPct}%, Snout-like=${snoutSnoutPct}%`);
    console.log(`  • Moon region:  Moon-like=${moonMoonPct}%, Snout-like=${moonSnoutPct}%`);

    // Suggest threshold based on minChannel or RGB average
    const snoutMinChannel = parseFloat(snoutResult.stats.avgMinChannel);
    const moonMinChannel = parseFloat(moonResult.stats.avgMinChannel);
    const suggestedThreshold = ((snoutMinChannel + moonMinChannel) / 2).toFixed(0);

    console.log(`\nSuggested threshold (minChannel): ${suggestedThreshold}`);
    console.log(`  • Pixels with minChannel < ${suggestedThreshold} → likely snout`);
    console.log(`  • Pixels with minChannel >= ${suggestedThreshold} → likely moon`);

    // Export detailed pixel data for further analysis
    console.log('\n' + '─'.repeat(80));
    console.log('EXPORTING DETAILED DATA');
    console.log('─'.repeat(80));

    const analysisData = {
      timestamp: new Date().toISOString(),
      imageSize: { width: metadata.width, height: metadata.height },
      regions: {
        snout: snoutResult,
        moon: moonResult,
      },
      comparison: {
        snoutAvgRgb,
        moonAvgRgb,
        snoutAvgMinChannel: parseFloat(snoutResult.stats.avgMinChannel),
        moonAvgMinChannel: parseFloat(moonResult.stats.avgMinChannel),
        suggestedMinChannelThreshold: parseInt(suggestedThreshold),
      },
    };

    const exportPath = path.resolve(__dirname, '../fixtures/wolf-analysis.json');
    await import('fs/promises').then(fs => fs.writeFile(exportPath, JSON.stringify(analysisData, null, 2)));
    console.log(`\nDetailed analysis saved to: ${exportPath}`);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
