import { z } from 'zod';
import { jwtVerify } from 'jose';
import { kv } from '@vercel/kv';
import { renderStitchChart } from '@/lib/svg';
import { getFriendlyColorName } from '@/lib/yarn';
import type { PatternData, StoredPattern, YarnInventoryEntry } from '@/lib/types';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const patternDataSchema = z.object({
  patternId: z.string().min(1),
  stitchGrid: z.array(z.array(z.number().int().min(0).max(250)).max(432)).min(1).max(432),
  sourceHintGrid: z.array(z.array(z.number().int().min(0).max(7)).max(432)).min(1).max(432).optional(),
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
  inventory: z.array(
    z.object({
      paletteIndex: z.number().int().min(0).max(250),
      hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      symbol: z.string().min(1).max(4),
      totalStitches: z.number().int().min(0).max(1_000_000),
      yardsNeeded: z.number().min(0).max(100_000),
      skeinsNeeded: z.number().int().min(0).max(10_000),
      yarnBrand: z.string().max(100).optional(),
      yarnColorName: z.string().max(100).optional(),
    }),
  ).max(250),
  aspectRatio: z.number().positive().max(20),
  title: z.string().min(1).max(200),
  stitchType: z.enum(['tapestry', 'c2c', 'knitting', 'cross-stitch']),
  outputType: z.enum(['blanket', 'beanie', 'scarf', 'amigurumi', 'top', 'sweater', 'shawl', 'hat', 'bag', 'pillow', 'wall-hanging', 'other']),
  customOutputTypeLabel: z.string().trim().min(2).max(40).optional(),
  yarnWeight: z.enum(['fingering', 'sport', 'dk', 'worsted', 'bulky', 'super-bulky']),
  hookSize: z.string().max(30),
  renderMode: z.enum(['graphic-clean-art', 'photo-gradient']).optional(),
  flattenBackgroundRegions: z.boolean().optional(),
  qualityWarnings: z.array(z.string().max(200)).optional(),
  qualityMetrics: z.object({
    duplicateColorRatio: z.number(),
    flatRegionFragmentation: z.number(),
    skyTreeContinuityScore: z.number(),
  }).optional(),
  qaFlags: z.array(z.string().max(200)).optional(),
  createdAt: z.string(),
});

const patchSchema = z.object({
  editToken: z.string().min(1),
  patternData: patternDataSchema,
});

async function verifyEditToken(editToken: string): Promise<{ patternId: string }> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('Server misconfiguration');
  }

  const secret = new TextEncoder().encode(jwtSecret);
  const { payload } = await jwtVerify(editToken, secret, { algorithms: ['HS256'] });
  if ((payload as Record<string, unknown>).pur !== 'edit' || typeof payload.sub !== 'string') {
    throw new Error('Invalid edit token');
  }

  return { patternId: payload.sub };
}

function rebuildInventory(patternData: PatternData): YarnInventoryEntry[] {
  const counts = new Array<number>(patternData.palette.length).fill(0);
  for (const row of patternData.stitchGrid) {
    for (const idx of row) {
      if (idx >= 0 && idx < counts.length) {
        counts[idx] += 1;
      }
    }
  }

  const previousByIndex = new Map(patternData.inventory.map((entry) => [entry.paletteIndex, entry]));

  return patternData.palette.map((entry, index) => {
    const prev = previousByIndex.get(index);
    const totalStitches = counts[index] ?? 0;

    const yardsPerStitch = prev && prev.totalStitches > 0
      ? prev.yardsNeeded / prev.totalStitches
      : 0.012;

    const inferredYardsPerSkein = prev && prev.skeinsNeeded > 0
      ? prev.yardsNeeded / prev.skeinsNeeded
      : 300;

    const yardsNeeded = Number((totalStitches * yardsPerStitch).toFixed(2));
    const skeinsNeeded = yardsNeeded > 0 ? Math.max(1, Math.ceil(yardsNeeded / inferredYardsPerSkein)) : 0;

    return {
      paletteIndex: index,
      hex: entry.hex,
      symbol: entry.symbol,
      totalStitches,
      yardsNeeded,
      skeinsNeeded,
      yarnBrand: entry.yarnBrand ?? prev?.yarnBrand,
      yarnColorName: entry.yarnColorName ?? prev?.yarnColorName,
    };
  });
}

function buildPreviewPayload(patternData: PatternData) {
  const previewSvg = renderStitchChart({
    stitchGrid: patternData.stitchGrid,
    sourceHintGrid: patternData.sourceHintGrid,
    palette: patternData.palette,
    preview: false,
  });

  const colorLegend = patternData.palette.map((p) => ({
    symbol: p.symbol,
    hex: p.hex,
    name: p.name ?? p.yarnColorName ?? getFriendlyColorName(p.hex),
    yarnBrand: p.yarnBrand,
    yarnColorName: p.yarnColorName,
  }));

  return {
    patternId: patternData.patternId,
    title: patternData.title ?? 'Untitled Pattern',
    previewSvg,
    colorLegend,
    totalLegendCount: patternData.palette.length,
    hiddenLegendCount: 0,
    totalRows: patternData.stitchGrid.length,
    isWatermarked: false,
  };
}

export async function GET(request: Request): Promise<Response> {
  const rateLimit = await checkRateLimit(request, 'preview');
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const { searchParams } = new URL(request.url);
  const editToken = searchParams.get('edit_token');
  if (!editToken) {
    return Response.json({ error: 'Missing edit_token query parameter' }, { status: 400 });
  }

  try {
    const { patternId } = await verifyEditToken(editToken);
    const stored = await kv.get<StoredPattern>(`pattern:${patternId}`);
    if (!stored) {
      return Response.json({ error: 'Pattern not found' }, { status: 404 });
    }

    return Response.json({
      patternData: stored,
      previewData: buildPreviewPayload(stored),
    });
  } catch {
    return Response.json({ error: 'Invalid or expired edit token' }, { status: 403 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const rateLimit = await checkRateLimit(request, 'preview');
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { editToken, patternData } = parsed.data;

  try {
    const { patternId } = await verifyEditToken(editToken);
    if (patternId !== patternData.patternId) {
      return Response.json({ error: 'Pattern/token mismatch' }, { status: 403 });
    }

    const mergedPattern: StoredPattern = {
      ...patternData,
      inventory: rebuildInventory(patternData),
      pdfBlobUrl: undefined,
    };

    await kv.set(`pattern:${patternId}`, mergedPattern, { ex: 172800 });

    return Response.json({
      patternData: mergedPattern,
      previewData: buildPreviewPayload(mergedPattern),
    });
  } catch {
    return Response.json({ error: 'Invalid or expired edit token' }, { status: 403 });
  }
}
