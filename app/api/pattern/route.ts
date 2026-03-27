import { z } from 'zod';
import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';
import { quantizeImage } from '@/lib/pattern';
import { renderStitchChart } from '@/lib/svg';
import { generatePatternPdf } from '@/lib/pdf';
import { generatePatternId } from '@/lib/types';
import type { PatternData, StoredPattern } from '@/lib/types';
import { type QuantizeResult } from '@/lib/pattern';
import { generateTitle } from '@/lib/prompts/titleGenerator';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
import { getFriendlyColorName } from '@/lib/yarn';

export const runtime = 'nodejs';
export const maxDuration = 60;

const schema = z.object({
  imageBase64: z.string().min(1),
  gridWidth: z.number().int().min(20).max(432),
  gridHeight: z.number().int().min(20).max(432),
  colorCount: z.number().int().min(2).max(12),
  brandId: z.string().optional(),
  selectedYarnColorIds: z.array(z.string().min(1)).optional(),
});

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request): Promise<Response> {
  try {
    const rateLimit = await checkRateLimit(request, 'pattern');
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

    const { imageBase64, gridWidth, gridHeight, colorCount, brandId, selectedYarnColorIds } = parsed.data;

    // Strip optional data URI prefix and validate decoded size
    const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const decodedByteLength = Math.floor((base64Data.length * 3) / 4);
    if (decodedByteLength > MAX_IMAGE_BYTES) {
      return Response.json(
        { error: 'Image exceeds maximum allowed size of 10 MB' },
        { status: 413 },
      );
    }

    const rawPattern: QuantizeResult = await quantizeImage({
      imageBase64: base64Data,
      gridWidth,
      gridHeight,
      colorCount,
      brandId,
      selectedYarnColorIds,
    });

    const patternId = generatePatternId();

    const colorNames = rawPattern.palette.map(
      (p) => p.yarnColorName ?? p.name ?? getFriendlyColorName(p.hex),
    );
    const { title } = await generateTitle({ colorNames });

    const patternData: PatternData = {
      patternId,
      ...rawPattern,
      title,
      createdAt: new Date().toISOString(),
    };

    const chartSvg = renderStitchChart({
      stitchGrid: patternData.stitchGrid,
      palette: patternData.palette,
      preview: false,
    });

    const pdfBuffer = await generatePatternPdf({ pattern: patternData, chartSvg });

    const blob = await put(`patterns/${patternId}.pdf`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
    });

    const storedPattern: StoredPattern = {
      ...patternData,
      pdfBlobUrl: blob.url,
    };

    await kv.set(`pattern:${patternId}`, storedPattern, { ex: 172800 }); // 48 hours

    // Never send pdfBlobUrl to the client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pdfBlobUrl: _omit, ...patternResponse } = storedPattern;

    return Response.json(patternResponse satisfies PatternData, { status: 200 });
  } catch (err) {
    console.error('[POST /api/pattern] generation failed', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
