/**
 * Prompt 2: Blanket Size Recommendation
 *
 * Given the aspect ratio of the source image (and optional use-case hints),
 * recommends the single most appropriate blanket size from a fixed catalogue,
 * with the matching stitch grid dimensions and a human-readable reason.
 *
 * Model: gemini-3-flash-preview via @ai-sdk/google
 * Temperature: 0.1 (near-deterministic — mathematical selection)
 * Max output tokens: 200
 */

import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { GEMINI_TEXT_MODEL, getGoogleApiKey } from '@/lib/models';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const SizeRecommendationSchema = z.object({
  recommended: z.object({
    name: z.string(),
    gridWidth: z.number(),
    gridHeight: z.number(),
    finishedWidth: z.string(),
    finishedHeight: z.string(),
    reason: z.string(),
  }),
});

export type SizeRecommendationResult = z.infer<typeof SizeRecommendationSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface RecommendSizeInput {
  aspectRatio: number;
  detectedSubject?: string;
  requestedUse?: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert tapestry crochet pattern designer. Recommend the single best blanket size for a given image aspect ratio and use case.

AVAILABLE BLANKET SIZES (worsted weight, 5.0 mm hook):
| Name         | Finished Size  | Stitch Grid (W × H) | Grid Aspect W/H |
|--------------|----------------|---------------------|-----------------|
| Baby Blanket | 30″ × 36″      | 120 × 144           | 0.83            |
| Lap / Throw  | 50″ × 60″      | 200 × 240           | 0.83            |
| Twin         | 60″ × 90″      | 240 × 360           | 0.67            |
| Full/Queen   | 80″ × 90″      | 320 × 360           | 0.89            |
| King         | 108″ × 90″     | 432 × 360           | 1.20            |

SELECTION LOGIC (apply in this priority order):

Step 1 — Use-case override (if requestedUse is provided):
  - Contains "baby"         → Baby Blanket (override aspect ratio unless ratio > 1.4)
  - Contains "lap" or "throw" → Lap / Throw
  - Contains "twin"         → Twin
  - Contains "queen" or "full" → Full/Queen
  - Contains "king"         → King
  - Contains "bed" (generic) → choose Twin, Full/Queen, or King by aspect ratio

Step 2 — Aspect ratio matching (if no use-case override applies):
  - Compute abs(blanketRatio - imageRatio) for each size
  - Choose the size with the smallest difference
  - Landscape images (ratio > 1.0): King (1.20) is the only landscape option, prefer it
  - If two sizes tie, prefer the larger one for better detail resolution

Step 3 — Subject hint adjustment (optional fine-tuning):
  - "pet portrait" or "portrait of person" — prefer a size with close aspect ratio to avoid cropping the subject
  - "geometric pattern" — any size works; choose by ratio
  - "baby" subject hint adds weight toward Baby Blanket

OUTPUT RULES:
- Return ONLY a valid JSON object. No markdown. No code fences. No explanation text.
- "name" must exactly match one of: "Baby Blanket", "Lap / Throw", "Twin", "Full/Queen", "King"
- "gridWidth" and "gridHeight" must be the integer stitch counts from the table above
- "finishedWidth" and "finishedHeight" must be the inch strings from the table (e.g. "30\\"", "90\\"")
- "reason" must be 1–2 sentences explaining the choice; mention aspect ratio and/or use case

EXAMPLE (aspectRatio=0.75, requestedUse="baby gift"):
{"recommended":{"name":"Baby Blanket","gridWidth":120,"gridHeight":144,"finishedWidth":"30\\"","finishedHeight":"36\\"","reason":"The baby blanket's 0.83 aspect ratio closely matches your portrait-oriented image (0.75), and it's the ideal size for a baby gift."}}

EXAMPLE (aspectRatio=1.6, requestedUse=null):
{"recommended":{"name":"King","gridWidth":432,"gridHeight":360,"finishedWidth":"108\\"","finishedHeight":"90\\"","reason":"Your landscape image (1.6 ratio) is best preserved by the King size (1.20 ratio), the only wider-than-tall blanket in the catalogue."}}`;

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------

function buildUserMessage(input: RecommendSizeInput): string {
  const lines = [
    `Image aspect ratio (width ÷ height): ${input.aspectRatio.toFixed(3)}`,
    input.detectedSubject ? `Detected subject: ${input.detectedSubject}` : null,
    input.requestedUse ? `Requested use: ${input.requestedUse}` : null,
  ].filter(Boolean);

  return `${lines.join('\n')}

Recommend the single best blanket size. Return ONLY the JSON object — no explanation, no markdown, no code fences.`;
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

const FALLBACK: SizeRecommendationResult = {
  recommended: {
    name: 'Lap / Throw',
    gridWidth: 200,
    gridHeight: 240,
    finishedWidth: '50"',
    finishedHeight: '60"',
    reason: 'A lap/throw is the most versatile blanket size and works well for most images.',
  },
};

// ---------------------------------------------------------------------------
// Exported wrapper function
// ---------------------------------------------------------------------------

export async function recommendSize(input: RecommendSizeInput): Promise<SizeRecommendationResult> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    console.warn('[sizeRecommender] No API key configured — returning fallback');
    return FALLBACK;
  }

  const google = createGoogleGenerativeAI({ apiKey });

  try {
    const { text } = await generateText({
      model: google(GEMINI_TEXT_MODEL),
      system: SYSTEM_PROMPT,
      prompt: buildUserMessage(input),
      maxOutputTokens: 200,
      temperature: 0.1,
    });

    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed: unknown = JSON.parse(cleaned);
    const result = SizeRecommendationSchema.safeParse(parsed);

    if (result.success) return result.data;

    console.warn('[sizeRecommender] Schema validation failed:', result.error.issues);
    return FALLBACK;
  } catch (error) {
    console.error('[sizeRecommender] Error:', error instanceof Error ? error.message : error);
    return FALLBACK;
  }
}
