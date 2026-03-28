import { readFile } from 'fs/promises';
import path from 'path';
import { quantizeImage } from '@/lib/pattern';
import { renderStitchChart } from '@/lib/svg';

export const runtime = 'nodejs';

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return Math.min(max, Math.max(min, rounded));
}

function countMatches(input: string, regex: RegExp): number {
  const matches = input.match(regex);
  return matches ? matches.length : 0;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const gridWidth = parseBoundedInt(url.searchParams.get('gridWidth'), 120, 20, 432);
    const gridHeight = parseBoundedInt(url.searchParams.get('gridHeight'), 160, 20, 432);
    const colorCount = parseBoundedInt(url.searchParams.get('colorCount'), 12, 2, 30);
    const includeSvg = url.searchParams.get('includeSvg') === '1';

    const wolfPath = path.join(process.cwd(), 'wolf.png');
    const imageBuffer = await readFile(wolfPath);
    const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    const quantized = await quantizeImage({
      imageBase64,
      gridWidth,
      gridHeight,
      colorCount,
      stitchType: 'tapestry',
      renderMode: 'photo-gradient',
      flattenBackgroundRegions: true,
    });

    const chartSvg = renderStitchChart({
      stitchGrid: quantized.stitchGrid,
      palette: quantized.palette,
      preview: false,
    });

    const colLabelCount = countMatches(chartSvg, /text-anchor="middle">[A-Z]{1,3}<\/text>/g);
    const leftRowLabelCount = countMatches(chartSvg, /text-anchor="end">\d+<\/text>/g);
    const rightRowLabelCount = countMatches(chartSvg, /text-anchor="start">\d+<\/text>/g);
    const legendHexCount = countMatches(chartSvg, />#[0-9A-Fa-f]{6}<\/text>/g);
    const legendSymbolCount = countMatches(chartSvg, /fill="#1f2937">[^<]{1,3}<\/text>/g);

    const checks = [
      {
        id: 'axis-column-labels',
        pass: colLabelCount >= 2,
        detail: `Found ${colLabelCount} column axis labels.`,
      },
      {
        id: 'axis-row-labels-left',
        pass: leftRowLabelCount >= 2,
        detail: `Found ${leftRowLabelCount} left row labels.`,
      },
      {
        id: 'axis-row-labels-right',
        pass: rightRowLabelCount >= 2,
        detail: `Found ${rightRowLabelCount} right row labels.`,
      },
      {
        id: 'legend-symbols',
        pass: legendSymbolCount >= Math.min(quantized.palette.length, 1),
        detail: `Found ${legendSymbolCount} legend symbols for ${quantized.palette.length} colors.`,
      },
      {
        id: 'legend-hex-values',
        pass: legendHexCount >= Math.min(quantized.palette.length, 1),
        detail: `Found ${legendHexCount} legend hex labels for ${quantized.palette.length} colors.`,
      },
    ];

    const overallPass = checks.every((check) => check.pass);

    return Response.json(
      {
        sourceImage: 'wolf.png',
        params: { gridWidth, gridHeight, colorCount },
        dimensions: quantized.dimensions,
        paletteCount: quantized.palette.length,
        overallPass,
        checks,
        qaFlags: quantized.qaFlags,
        qualityWarnings: quantized.qualityWarnings,
        ...(includeSvg ? { chartSvg } : {}),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[GET /api/verify/wolf] verification failed', err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}