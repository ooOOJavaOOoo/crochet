import { z } from 'zod';
import { jwtVerify } from 'jose';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GEMINI_TEXT_MODEL, getGoogleApiKey } from '@/lib/models';
import type { PatternData, YarnInventoryEntry } from '@/lib/types';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const schema = z.object({
  editToken: z.string().min(1),
  instruction: z.string().min(3).max(400),
  patternData: z.object({
    patternId: z.string().min(1),
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
  }),
});

function extractJsonObject(raw: string): string | null {
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  return raw.slice(firstBrace, lastBrace + 1);
}

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

function applyRecolorMapping(patternData: PatternData, mapping: Array<{ fromSymbol: string; toSymbol: string }>): PatternData {
  const symbolToIndex = new Map(patternData.palette.map((entry) => [entry.symbol, entry.index]));
  const fromTo = new Map<number, number>();

  for (const item of mapping) {
    const fromIdx = symbolToIndex.get(item.fromSymbol);
    const toIdx = symbolToIndex.get(item.toSymbol);
    if (fromIdx === undefined || toIdx === undefined || fromIdx === toIdx) {
      continue;
    }
    fromTo.set(fromIdx, toIdx);
  }

  if (fromTo.size === 0) {
    return patternData;
  }

  const stitchGrid = patternData.stitchGrid.map((row) => row.map((idx) => fromTo.get(idx) ?? idx));

  return {
    ...patternData,
    stitchGrid,
  };
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = await checkRateLimit(request, 'chat');
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

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

  const { editToken, instruction, patternData } = parsed.data;

  try {
    const { patternId } = await verifyEditToken(editToken);
    if (patternId !== patternData.patternId) {
      return Response.json({ error: 'Pattern/token mismatch' }, { status: 403 });
    }

    const apiKey = getGoogleApiKey();
    if (!apiKey) {
      return Response.json({ error: 'Google API key is not configured.' }, { status: 500 });
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const paletteSummary = patternData.palette
      .map((entry) => `${entry.symbol}: ${entry.yarnColorName ?? entry.name ?? entry.hex}`)
      .join('\n');

    const prompt = [
      'You are editing a crochet chart by remapping one symbol color to another existing symbol color.',
      'Only use symbols that exist in the palette. Do not invent symbols.',
      'Return strict JSON only with this shape:',
      '{"recolor":[{"fromSymbol":"A","toSymbol":"B"}],"reason":"short explanation"}',
      'If no safe change is possible, return {"recolor":[],"reason":"..."}.',
      'Palette:',
      paletteSummary,
      `User instruction: ${instruction}`,
    ].join('\n');

    const llm = await generateText({
      model: google(GEMINI_TEXT_MODEL),
      prompt,
      temperature: 0.1,
      maxOutputTokens: 400,
    });

    const jsonText = extractJsonObject(llm.text ?? '');
    if (!jsonText) {
      return Response.json({ error: 'AI edit did not return a valid response.' }, { status: 422 });
    }

    const parsedJson = z.object({
      recolor: z.array(z.object({ fromSymbol: z.string().min(1).max(4), toSymbol: z.string().min(1).max(4) })).max(20),
      reason: z.string().max(300).optional(),
    }).safeParse(JSON.parse(jsonText));

    if (!parsedJson.success) {
      return Response.json({ error: 'AI edit response was invalid.' }, { status: 422 });
    }

    const remapped = applyRecolorMapping(patternData, parsedJson.data.recolor);
    const updated: PatternData = {
      ...remapped,
      inventory: rebuildInventory(remapped),
    };

    return Response.json({
      patternData: updated,
      appliedRecolorCount: parsedJson.data.recolor.length,
      reason: parsedJson.data.reason ?? null,
    });
  } catch {
    return Response.json({ error: 'Invalid or expired edit token' }, { status: 403 });
  }
}
