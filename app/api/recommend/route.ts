/**
 * POST /api/recommend
 *
 * Runs three focused Gemini prompts in parallel:
 *   1. matchColors   — hex → human names + yarn matches
 *   2. recommendSize — aspect ratio → blanket size + grid
 *   3. generateTitle — palette + subject → pattern title
 *
 * Request body:
 * {
 *   hexColors: string[];           // required — from image quantization
 *   aspectRatio: number;           // required — width/height of source image
 *   yarnBrand?: string;            // optional brand filter
 *   detectedSubject?: string;      // optional — e.g. "pet portrait"
 *   requestedUse?: string;         // optional — e.g. "baby gift"
 *   imageDescription?: string;     // optional — user's original text prompt
 * }
 */

import { NextResponse } from 'next/server';
import { matchColors, type YarnBrand } from '@/lib/prompts/colorMatcher';
import { recommendSize } from '@/lib/prompts/sizeRecommender';
import { generateTitle } from '@/lib/prompts/titleGenerator';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, 'recommend');
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray((body as Record<string, unknown>).hexColors) ||
    typeof (body as Record<string, unknown>).aspectRatio !== 'number'
  ) {
    return NextResponse.json(
      { error: 'hexColors (string[]) and aspectRatio (number) are required' },
      { status: 400 }
    );
  }

  const {
    hexColors,
    aspectRatio,
    yarnBrand,
    detectedSubject,
    requestedUse,
    imageDescription,
  } = body as {
    hexColors: string[];
    aspectRatio: number;
    yarnBrand?: YarnBrand;
    detectedSubject?: string;
    requestedUse?: string;
    imageDescription?: string;
  };

  // Run all three prompts in parallel — failures return fallbacks, never throw
  const [colorResult, sizeResult] = await Promise.all([
    matchColors({ hexColors, yarnBrand }),
    recommendSize({ aspectRatio, detectedSubject, requestedUse }),
  ]);

  // Title needs color names from step 1 — run sequentially after colors resolve
  const colorNames = colorResult.colors.map((c) => c.name);
  const titleResult = await generateTitle({ imageDescription, colorNames, subjectHint: detectedSubject });

  return NextResponse.json({
    colors: colorResult.colors,
    size: sizeResult.recommended,
    title: titleResult.title,
    subtitle: titleResult.subtitle,
  });
}
