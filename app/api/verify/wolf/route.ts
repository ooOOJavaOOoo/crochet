import { readFile } from 'fs/promises';
import path from 'path';
import { quantizeImage } from '@/lib/pattern';
import { getChartGridForRender, renderStitchChart, validateStitchChartSvg } from '@/lib/svg';

export const runtime = 'nodejs';

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return Math.min(max, Math.max(min, rounded));
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
}

function isNearWhitePaletteHex(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const avg = (r + g + b) / 3;
  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);
  const spread = maxChannel - minChannel;
  const blueBias = b - r;
  return avg >= 214 && minChannel >= 198 && spread <= 34 && blueBias <= 16;
}

function toGridCoord(size: number, ratio: number): number {
  return Math.max(0, Math.min(size - 1, Math.round(size * ratio)));
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const gridWidth = parseBoundedInt(url.searchParams.get('gridWidth'), 120, 20, 432);
    const gridHeight = parseBoundedInt(url.searchParams.get('gridHeight'), 160, 20, 432);
    const colorCount = parseBoundedInt(url.searchParams.get('colorCount'), 12, 2, 30);
    const includeSvg = url.searchParams.get('includeSvg') === '1';
    const debugOverlay = url.searchParams.get('debugOverlay') === 'wolf' ? 'wolf' : undefined;

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
      sourceHintGrid: quantized.sourceHintGrid,
      palette: quantized.palette,
      preview: false,
      debugOverlay,
    });

    const svgValidation = validateStitchChartSvg({
      svg: chartSvg,
      gridWidth,
      gridHeight,
      paletteSize: quantized.palette.length,
      expectAxisLabels: true,
      expectLegend: true,
    });

    const checks = [...svgValidation.checks];

    const correctedGrid = getChartGridForRender(
      quantized.stitchGrid,
      quantized.palette,
      quantized.sourceHintGrid,
      true,
    );

    const whiteIndices = new Set(
      quantized.palette
        .filter((entry) => isNearWhitePaletteHex(entry.hex))
        .map((entry) => entry.index),
    );

    const countWhiteInRegion = (
      xStart: number,
      xEnd: number,
      yStart: number,
      yEnd: number,
    ): { whiteCount: number; total: number } => {
      let whiteCount = 0;
      let total = 0;

      for (let y = yStart; y <= yEnd; y++) {
        for (let x = xStart; x <= xEnd; x++) {
          total++;
          if (whiteIndices.has(correctedGrid[y]?.[x] ?? -1)) whiteCount++;
        }
      }

      return { whiteCount, total };
    };

    const muzzleRegion = {
      xStart: toGridCoord(gridWidth, 74 / 120),
      xEnd: toGridCoord(gridWidth, 84 / 120),
      yStart: toGridCoord(gridHeight, 121 / 160),
      yEnd: toGridCoord(gridHeight, 130 / 160),
    };
    const moonCoreRegion = {
      xStart: toGridCoord(gridWidth, 74 / 120),
      xEnd: toGridCoord(gridWidth, 82 / 120),
      yStart: toGridCoord(gridHeight, 140 / 160),
      yEnd: toGridCoord(gridHeight, 145 / 160),
    };
    const headRegion = {
      xStart: toGridCoord(gridWidth, 54 / 120),
      xEnd: toGridCoord(gridWidth, 98 / 120),
      yStart: toGridCoord(gridHeight, 100 / 160),
      yEnd: toGridCoord(gridHeight, 136 / 160),
    };
    const moonProtectRegion = {
      xStart: toGridCoord(gridWidth, 70 / 120),
      xEnd: toGridCoord(gridWidth, 86 / 120),
      yStart: toGridCoord(gridHeight, 130 / 160),
      yEnd: toGridCoord(gridHeight, 148 / 160),
    };

    const muzzleWhite = countWhiteInRegion(
      muzzleRegion.xStart,
      muzzleRegion.xEnd,
      muzzleRegion.yStart,
      muzzleRegion.yEnd,
    );
    const moonCoreWhite = countWhiteInRegion(
      moonCoreRegion.xStart,
      moonCoreRegion.xEnd,
      moonCoreRegion.yStart,
      moonCoreRegion.yEnd,
    );
    const headWhite = (() => {
      let whiteCount = 0;
      let total = 0;

      for (let y = headRegion.yStart; y <= headRegion.yEnd; y++) {
        for (let x = headRegion.xStart; x <= headRegion.xEnd; x++) {
          const inMoonProtect =
            x >= moonProtectRegion.xStart &&
            x <= moonProtectRegion.xEnd &&
            y >= moonProtectRegion.yStart &&
            y <= moonProtectRegion.yEnd;
          if (inMoonProtect) continue;

          total++;
          if (whiteIndices.has(correctedGrid[y]?.[x] ?? -1)) whiteCount++;
        }
      }

      return { whiteCount, total };
    })();

    const maxMuzzleWhiteLeak = Math.max(4, Math.floor(muzzleWhite.total * 0.08));
    const maxHeadWhiteLeak = Math.max(6, Math.floor(headWhite.total * 0.01));
    const minMoonCoreWhite = Math.max(6, Math.floor(moonCoreWhite.total * 0.68));

    checks.push(
      {
        id: 'wolf-muzzle-white-leak',
        pass: muzzleWhite.whiteCount <= maxMuzzleWhiteLeak,
        detail:
          `Muzzle white stitches ${muzzleWhite.whiteCount}/${muzzleWhite.total}; ` +
          `allowed <= ${maxMuzzleWhiteLeak}.`,
      },
      {
        id: 'wolf-head-white-leak',
        pass: headWhite.whiteCount <= maxHeadWhiteLeak,
        detail:
          `Head white stitches ${headWhite.whiteCount}/${headWhite.total}; ` +
          `allowed <= ${maxHeadWhiteLeak}.`,
      },
      {
        id: 'wolf-moon-core-white-preserved',
        pass: moonCoreWhite.whiteCount >= minMoonCoreWhite,
        detail:
          `Moon core white stitches ${moonCoreWhite.whiteCount}/${moonCoreWhite.total}; ` +
          `required >= ${minMoonCoreWhite}.`,
      },
    );

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