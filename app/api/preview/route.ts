import { z } from 'zod';
import { kv } from '@vercel/kv';
import { renderStitchChart } from '@/lib/svg';
import { getFriendlyColorName } from '@/lib/yarn';
import type { PatternData, StoredPattern } from '@/lib/types';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const schema = z
  .object({
    patternId: z.string().optional(),
    patternData: z
      .object({
        patternId: z.string().optional(),
        title: z.string().max(200).optional(),
        stitchGrid: z.array(z.array(z.number().int().min(0).max(250)).max(432)).min(1).max(432),
        palette: z.array(
          z.object({
            index: z.number().int().min(0).max(250),
            hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
            symbol: z.string().min(1).max(4),
            pixelCount: z.number().int().min(0).max(1_000_000),
            name: z.string().max(100).optional(),
            yarnBrand: z.string().max(100).optional(),
            yarnColorName: z.string().max(100).optional(),
          }),
        ).min(1).max(250),
        dimensions: z.object({ width: z.number().int().min(1).max(432), height: z.number().int().min(1).max(432) }),
        inventory: z.array(z.object({
          paletteIndex: z.number().int().min(0).max(250),
          hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          symbol: z.string().min(1).max(4),
          totalStitches: z.number().int().min(0).max(1_000_000),
          yardsNeeded: z.number().min(0).max(100_000),
          skeinsNeeded: z.number().int().min(0).max(10_000),
          yarnBrand: z.string().max(100).optional(),
          yarnColorName: z.string().max(100).optional(),
        })).max(250),
      })
      .optional(),
  })
  .refine((d) => d.patternId !== undefined || d.patternData !== undefined, {
    message: 'Provide patternId or patternData',
  });

export async function POST(request: Request): Promise<Response> {
  const rateLimit = await checkRateLimit(request, 'preview');
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { patternId: requestedId, patternData: inlineData } = parsed.data;

    let patternData: PatternData;
    let resolvedPatternId: string;

    if (requestedId) {
      const stored = await kv.get<StoredPattern>(`pattern:${requestedId}`);
      if (!stored) {
        return Response.json({ error: 'Pattern not found' }, { status: 404 });
      }
      patternData = stored;
      resolvedPatternId = requestedId;
    } else {
      // Use inline patternData — caller is responsible for providing valid data
      patternData = inlineData as PatternData;
      resolvedPatternId = patternData.patternId ?? 'preview';
    }

    const totalLegendCount = patternData.palette.length;
    const previewLegendCount = Math.max(1, Math.ceil(totalLegendCount / 2));
    const previewSvg = renderStitchChart({
      stitchGrid: patternData.stitchGrid,
      palette: patternData.palette,
      preview: false,
      legendLimit: previewLegendCount,
    });

    const colorLegend = patternData.palette.slice(0, previewLegendCount).map((p) => ({
      symbol: p.symbol,
      hex: p.hex,
      name: p.name ?? p.yarnColorName ?? getFriendlyColorName(p.hex),
      yarnBrand: p.yarnBrand,
      yarnColorName: p.yarnColorName,
    }));

    return Response.json({
      patternId: resolvedPatternId,
      title: patternData.title ?? 'Untitled Pattern',
      previewSvg,
      colorLegend,
      totalLegendCount,
      hiddenLegendCount: totalLegendCount - previewLegendCount,
      totalRows: patternData.stitchGrid.length,
      isWatermarked: true,
    });
  } catch (err) {
    console.error('[POST /api/preview] rendering failed', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
