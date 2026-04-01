import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pdfModule = await import('../lib/pdf.ts');
const svgModule = await import('../lib/svg.ts');
const patternModule = await import('../lib/pattern.ts');

const generatePatternPdf = pdfModule.generatePatternPdf ?? pdfModule.default?.generatePatternPdf;
const renderStitchChart = svgModule.renderStitchChart ?? svgModule.default?.renderStitchChart;
const quantizeImage = patternModule.quantizeImage ?? patternModule.default?.quantizeImage;

if (typeof generatePatternPdf !== 'function') {
  throw new Error('Could not load generatePatternPdf from lib/pdf.ts');
}

if (typeof renderStitchChart !== 'function') {
  throw new Error('Could not load renderStitchChart from lib/svg.ts');
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
  return avg >= 226 && (max - min) <= 22;
}

function assertNoWolfMuzzleWhiteLeak(pattern) {
  const { stitchGrid, palette, dimensions } = pattern;
  const width = dimensions.width;
  const height = dimensions.height;

  const whiteIndices = new Set(
    palette
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => isWhiteLikeHex(entry.hex))
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

async function main() {
  const outputArg = process.argv[2];
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : path.resolve(__dirname, '..', 'fixtures', 'local-pattern-fixture.pdf');

  const pattern = await buildPatternFromWolf();
  assertNoWolfMuzzleWhiteLeak(pattern);

  const chartSvg = renderStitchChart({
    stitchGrid: pattern.stitchGrid,
    palette: pattern.palette,
    preview: false,
  });

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
