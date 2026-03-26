import { z } from 'zod';
import { kv } from '@vercel/kv';
import { renderStitchChart } from '@/lib/svg';
import type { PatternData, StoredPattern } from '@/lib/types';

export const runtime = 'nodejs';

const schema = z
  .object({
    patternId: z.string().optional(),
    patternData: z
      .object({
        stitchGrid: z.array(z.array(z.number())),
        palette: z.array(z.any()),
        dimensions: z.object({ width: z.number(), height: z.number() }),
        inventory: z.array(z.any()),
      })
      .optional(),
  })
  .refine((d) => d.patternId !== undefined || d.patternData !== undefined, {
    message: 'Provide patternId or patternData',
  });

export async function POST(request: Request): Promise<Response> {
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

  const previewSvg = renderStitchChart({
    stitchGrid: patternData.stitchGrid,
    palette: patternData.palette,
    preview: true,
  });

  const colorLegend = patternData.palette.map((p) => ({
    symbol: p.symbol,
    hex: p.hex,
    name: p.name ?? p.hex,
  }));

  const yarnSummary = patternData.inventory.map((entry) => {
    const pal = patternData.palette.find((p) => p.index === entry.paletteIndex);
    return {
      symbol: pal?.symbol ?? String(entry.paletteIndex),
      hex: entry.hex,
      yardsNeeded: entry.yardsNeeded,
      skeinsNeeded: entry.skeinsNeeded,
      yarnBrand: entry.yarnBrand,
      yarnColorName: entry.yarnColorName,
    };
  });

  return Response.json({
    patternId: resolvedPatternId,
    title: patternData.title ?? 'Untitled Pattern',
    previewSvg,
    colorLegend,
    yarnSummary,
    totalRows: patternData.stitchGrid.length,
    isWatermarked: true,
  });
}
