import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pdfModule = await import('../lib/pdf.ts');
const svgModule = await import('../lib/svg.ts');
const patternModule = await import('../lib/pattern.ts');

const generatePatternPdf = pdfModule.generatePatternPdf ?? pdfModule.default?.generatePatternPdf;
const renderStitchChart = svgModule.renderStitchChart ?? svgModule.default?.renderStitchChart;
const validateStitchChartSvg = svgModule.validateStitchChartSvg ?? svgModule.default?.validateStitchChartSvg;
const quantizeImage = patternModule.quantizeImage ?? patternModule.default?.quantizeImage;

if (typeof generatePatternPdf !== 'function') {
  throw new Error('Could not load generatePatternPdf from lib/pdf.ts');
}

if (typeof renderStitchChart !== 'function') {
  throw new Error('Could not load renderStitchChart from lib/svg.ts');
}

if (typeof validateStitchChartSvg !== 'function') {
  throw new Error('Could not load validateStitchChartSvg from lib/svg.ts');
}

if (typeof quantizeImage !== 'function') {
  throw new Error('Could not load quantizeImage from lib/pattern.ts');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildPatternFromWolf() {
  const wolfPath = path.resolve(__dirname, '..', 'wolf.png');
  const wolfBuffer = await readFile(wolfPath);
  const imageBase64 = `data:image/png;base64,${wolfBuffer.toString('base64')}`;

  const rawPattern = await quantizeImage({
    imageBase64,
    gridWidth: 120,
    gridHeight: 160,
    colorCount: 12,
    stitchType: 'tapestry',
    yarnWeight: 'worsted',
    hookSize: '5.0mm (H-8)',
    renderMode: 'photo-gradient',
    flattenBackgroundRegions: true,
  });

  return {
    patternId: 'fixture_wolf_pdf',
    title: 'Wolf PDF Fixture',
    ...rawPattern,
    createdAt: new Date().toISOString(),
  };
}

function isWhiteLikeHex(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const avg = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const blueBias = b - r;
  return avg >= 214 && min >= 198 && (max - min) <= 34 && blueBias <= 16;
}

function isBrightWhiteLikeHex(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const avg = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return avg >= 226 && (max - min) <= 22;
}

function isGrayLikeHex(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isWhiteLikeHex(hex)) return false;
  const avg = (r + g + b) / 3;
  return Math.abs(r - g) <= 24 && Math.abs(g - b) <= 24 && avg >= 96 && avg <= 232;
}

function topPctToStitchRow(height, topPct) {
  const clamped = Math.min(1, Math.max(0, topPct));
  return Math.min(height - 1, Math.max(0, Math.floor((1 - clamped) * height)));
}

function assertNoWolfMuzzleWhiteLeak(pattern) {
  const { stitchGrid, palette, dimensions } = pattern;
  const width = dimensions.width;
  const height = dimensions.height;

  const whiteIndices = new Set(
    palette
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => isBrightWhiteLikeHex(entry.hex))
      .map(({ idx }) => idx),
  );

  if (whiteIndices.size === 0) {
    return;
  }

  // Wolf fixture-specific diagnostic window around the muzzle area.
  const xStart = Math.max(0, Math.floor(width * 0.48));
  const xEnd = Math.min(width, Math.ceil(width * 0.70));
  const yStart = Math.max(0, Math.floor(height * 0.66));
  const yEnd = Math.min(height, Math.ceil(height * 0.83));

  let suspiciousWhiteCells = 0;
  let windowCells = 0;

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      windowCells++;

      const colorIdx = stitchGrid[y]?.[x];
      if (!whiteIndices.has(colorIdx)) continue;

      let nonWhiteNeighbors = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const ny = y + oy;
          const nx = x + ox;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          const nIdx = stitchGrid[ny]?.[nx];
          if (!whiteIndices.has(nIdx)) nonWhiteNeighbors++;
        }
      }

      // Interior white with mixed neighbors in muzzle window is suspicious.
      if (nonWhiteNeighbors >= 3) {
        suspiciousWhiteCells++;
      }
    }
  }

  const suspiciousRatio = windowCells > 0 ? suspiciousWhiteCells / windowCells : 0;

  if (suspiciousWhiteCells >= 14 && suspiciousRatio >= 0.05) {
    throw new Error(
      `Wolf muzzle white-leak guard failed (${suspiciousWhiteCells} suspicious white cells in diagnostic window).`,
    );
  }
}

function assertNoWolfMoonEdgeGrayLeak(pattern) {
  const { stitchGrid, palette, dimensions } = pattern;
  const width = dimensions.width;
  const height = dimensions.height;

  const whiteIndices = new Set(
    palette
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => isWhiteLikeHex(entry.hex))
      .map(({ idx }) => idx),
  );
  const grayIndices = new Set(
    palette
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => isGrayLikeHex(entry.hex))
      .map(({ idx }) => idx),
  );

  if (whiteIndices.size === 0 || grayIndices.size === 0) {
    return;
  }

  // Top-origin window (matching chart display): upper-right moon/muzzle overlap.
  const xStart = Math.max(1, Math.floor(width * 0.62));
  const xEnd = Math.min(width - 1, Math.ceil(width * 0.82));
  const yStart = topPctToStitchRow(height, 0.18);
  const yEndExclusive = Math.min(height, topPctToStitchRow(height, 0.06) + 1);

  let windowCells = 0;
  let whiteCells = 0;
  let grayCells = 0;
  let suspiciousGrayCells = 0;
  let maxGrayComponent = 0;
  const visited = new Set();

  const keyFor = (x, y) => `${x}:${y}`;

  const inWindow = (x, y) => x >= xStart && x < xEnd && y >= yStart && y < yEndExclusive;

  const grayInWindow = (x, y) => {
    if (!inWindow(x, y)) return false;
    const idx = stitchGrid[y]?.[x];
    return grayIndices.has(idx);
  };

  for (let y = yStart; y < yEndExclusive; y++) {
    for (let x = xStart; x < xEnd; x++) {
      windowCells++;
      const colorIdx = stitchGrid[y]?.[x];
      if (whiteIndices.has(colorIdx)) whiteCells++;
      if (!grayIndices.has(colorIdx)) continue;
      grayCells++;

      let whiteNeighbors = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const ny = y + oy;
          const nx = x + ox;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          const nIdx = stitchGrid[ny]?.[nx];
          if (whiteIndices.has(nIdx)) whiteNeighbors++;
        }
      }

      if (whiteNeighbors >= 5) {
        suspiciousGrayCells++;
      }

      const key = keyFor(x, y);
      if (visited.has(key)) continue;

      // Measure largest connected gray blob inside the moon-edge window.
      let componentSize = 0;
      const queue = [[x, y]];
      visited.add(key);

      while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        componentSize++;

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (!grayInWindow(nx, ny)) continue;
          const nKey = keyFor(nx, ny);
          if (visited.has(nKey)) continue;
          visited.add(nKey);
          queue.push([nx, ny]);
        }
      }

      if (componentSize > maxGrayComponent) maxGrayComponent = componentSize;
    }
  }

  const whiteRatio = windowCells > 0 ? whiteCells / windowCells : 0;
  const grayRatio = windowCells > 0 ? grayCells / windowCells : 0;
  const moonClassifiedCells = whiteCells + grayCells;
  const whiteAmongMoonClassified = moonClassifiedCells > 0 ? whiteCells / moonClassifiedCells : 1;

  if (whiteAmongMoonClassified < 0.90 || grayRatio > 0.05 || maxGrayComponent > 3 || suspiciousGrayCells > 1) {
    throw new Error(
      `Wolf moon-edge distinctness guard failed (whiteRatio=${whiteRatio.toFixed(3)}, whiteAmongMoonClassified=${whiteAmongMoonClassified.toFixed(3)}, grayRatio=${grayRatio.toFixed(3)}, maxGrayComponent=${maxGrayComponent}, suspiciousGrayCells=${suspiciousGrayCells}).`,
    );
  }
}

function assertWolfMuzzleHighlightGrayPresence(pattern) {
  const { stitchGrid, palette, dimensions } = pattern;
  const width = dimensions.width;
  const height = dimensions.height;

  const whiteIndices = new Set(
    palette
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => isWhiteLikeHex(entry.hex))
      .map(({ idx }) => idx),
  );
  const brightWhiteIndices = new Set(
    palette
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => isBrightWhiteLikeHex(entry.hex))
      .map(({ idx }) => idx),
  );
  const grayIndices = new Set(
    palette
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => isGrayLikeHex(entry.hex))
      .map(({ idx }) => idx),
  );

  if (grayIndices.size === 0) {
    return;
  }

  // Top-origin highlighted muzzle window, just below moon-edge guard.
  const xStart = Math.max(0, Math.floor(width * 0.56));
  const xEnd = Math.min(width, Math.ceil(width * 0.72));
  const yStart = topPctToStitchRow(height, 0.36);
  const yEndExclusive = Math.min(height, topPctToStitchRow(height, 0.22) + 1);

  let windowCells = 0;
  let grayCells = 0;
  let whiteCells = 0;
  let brightWhiteCells = 0;

  for (let y = yStart; y < yEndExclusive; y++) {
    for (let x = xStart; x < xEnd; x++) {
      windowCells++;
      const idx = stitchGrid[y]?.[x];
      if (grayIndices.has(idx)) grayCells++;
      if (whiteIndices.has(idx)) whiteCells++;
      if (brightWhiteIndices.has(idx)) brightWhiteCells++;
    }
  }

  if (windowCells === 0) return;

  const grayRatio = grayCells / windowCells;
  const whiteRatio = whiteCells / windowCells;
  const brightWhiteRatio = brightWhiteCells / windowCells;

  if (grayRatio < 0.20 || whiteRatio > 0.70 || brightWhiteRatio > 0.50) {
    throw new Error(
      `Wolf muzzle highlight gray guard failed (grayRatio=${grayRatio.toFixed(3)}, whiteRatio=${whiteRatio.toFixed(3)}, brightWhiteRatio=${brightWhiteRatio.toFixed(3)}, grayCells=${grayCells}, windowCells=${windowCells}).`,
    );
  }
}

function reportRegionMetrics(pattern) {
  const { stitchGrid, palette, dimensions } = pattern;

  const whiteIndices = new Set(
    palette
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => isWhiteLikeHex(entry.hex))
      .map(({ idx }) => idx),
  );
  const grayIndices = new Set(
    palette
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => isGrayLikeHex(entry.hex))
      .map(({ idx }) => idx),
  );

  function analyzeRegion(xStart, xEnd, yStart, yEnd, label) {
    let whiteLikeCells = 0;
    let grayLikeCells = 0;
    let totalCells = 0;

    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        totalCells++;
        const colorIdx = stitchGrid[y]?.[x];
        if (whiteIndices.has(colorIdx)) whiteLikeCells++;
        if (grayIndices.has(colorIdx)) grayLikeCells++;
      }
    }

    console.log(
      `  ${label} (${xStart}..${xEnd-1}, ${yStart}..${yEnd-1}): white=${whiteLikeCells}, gray=${grayLikeCells}, total=${totalCells}`,
    );
    return { whiteLikeCells, grayLikeCells, totalCells };
  }

  console.log('Region Metrics:');
  analyzeRegion(72, 87, 118, 133, 'Outer');
  analyzeRegion(74, 85, 121, 131, 'Focused');
}

async function main() {
  const outputArg = process.argv[2];
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : path.resolve(__dirname, '..', 'fixtures', 'local-pattern-fixture.pdf');

  const pattern = await buildPatternFromWolf();
  assertNoWolfMuzzleWhiteLeak(pattern);
  assertWolfMuzzleHighlightGrayPresence(pattern);
  assertNoWolfMoonEdgeGrayLeak(pattern);
  reportRegionMetrics(pattern);

  const chartSvg = renderStitchChart({
    stitchGrid: pattern.stitchGrid,
    sourceHintGrid: pattern.sourceHintGrid,
    palette: pattern.palette,
    preview: false,
  });

  const svgValidation = validateStitchChartSvg({
    svg: chartSvg,
    gridWidth: pattern.dimensions.width,
    gridHeight: pattern.dimensions.height,
    paletteSize: pattern.palette.length,
    expectAxisLabels: true,
    expectLegend: true,
  });
  if (!svgValidation.overallPass) {
    const failed = svgValidation.checks
      .filter((check) => !check.pass)
      .map((check) => `${check.id}: ${check.detail}`)
      .join(' | ');
    throw new Error(`SVG preflight failed before PDF conversion: ${failed}`);
  }

  const pdf = await generatePatternPdf({
    pattern,
    chartSvg,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, pdf);

  console.log(`PDF fixture generated from wolf.png: ${outputPath}`);
}

main().catch((error) => {
  console.error('Failed to generate PDF fixture:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
