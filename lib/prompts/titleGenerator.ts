/**
 * Prompt 3: Pattern Title Generator
 *
 * Generates a creative, evocative tapestry crochet pattern name and subtitle
 * based on the image's color palette, subject matter, and/or user description.
 *
 * Model: gemini-3-flash-preview via @ai-sdk/google
 * Temperature: 0.8 (creative — varied, evocative outputs)
 * Max output tokens: 80
 */

import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { GEMINI_TEXT_MODEL, getGoogleApiKey } from '@/lib/models';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const PatternTitleSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
});

export type PatternTitleResult = z.infer<typeof PatternTitleSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface GenerateTitleInput {
  imageDescription?: string;
  colorNames: string[];
  subjectHint?: string;
  outputTypeLabel?: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a creative director at a crochet pattern publishing house. Your job is to write memorable, evocative pattern names that a crafter would be excited to search for and make.

TITLE FORMAT:
- 2–4 content words PLUS an optional blanket-type suffix
- Allowed suffixes: Blanket · Throw · Tapestry · Afghan · Wrap (pick one that fits the mood)
- Total title length: max 6 words
- Title Case throughout

TITLE STRATEGY — reference exactly ONE of these anchors:
  • Color mood  → "Autumn Ember Throw", "Midnight Indigo Afghan"
  • Subject     → "Golden Retriever Portrait Blanket", "Mountain Horizon Tapestry"
  • Season/time → "Midsummer Meadow Blanket", "Winter Solstice Afghan"
  • Place/scene → "Desert Canyon Tapestry", "Nordic Fjord Throw"
  • Texture/pattern → "Geometric Chevron Afghan", "Diamond Lattice Throw"

WHAT MAKES A GOOD TITLE:
✓ Specific and visual — conjures an image in the reader's mind
✓ Uses strong nouns + descriptive adjectives
✓ Sounds like something you'd see in a craft magazine or on Ravelry
✓ Works as a search term a crocheter would actually use

WHAT TO AVOID:
✗ Generic filler words: "Beautiful", "Pretty", "Nice", "Colorful", "Lovely"
✗ Vague nouns: "Design", "Creation", "Project", "Work", "Piece"
✗ Redundant: "Crochet Crochet Blanket" — only use "crochet" if it adds meaning
✗ Titles longer than 6 words

SUBTITLE FORMAT:
- Factual, 1 sentence
- Pattern: "A tapestry crochet pattern in [N] colors" optionally extended with subject or mood
- Example: "A tapestry crochet pattern in 4 warm earth tones"
- Example: "A tapestry crochet pattern in 5 colors inspired by autumn woodland"

OUTPUT RULES:
- Return ONLY a valid JSON object. No markdown. No code fences. No explanation.
- "title" must be a single string in Title Case, max 6 words
- "subtitle" must be a single sentence beginning with "A tapestry crochet pattern"

EXAMPLES:
Input: colors=["Warm Caramel","Deep Espresso","Harvest Gold"], subject="autumn leaves"
Output: {"title":"Autumn Harvest Tapestry","subtitle":"A tapestry crochet pattern in 3 warm autumn tones"}

Input: colors=["Ocean Blue","Seafoam","Sandy Beige"], subject="coastal scene"
Output: {"title":"Coastal Horizon Throw","subtitle":"A tapestry crochet pattern in 3 ocean-inspired colours"}

Input: colors=["Charcoal Grey","Pure White","Stone"], subject=null, description="geometric repeating pattern"
Output: {"title":"Geometric Storm Afghan","subtitle":"A tapestry crochet pattern in 3 high-contrast neutrals"}

Input: colors=["Soft Blush","Rose","Dusty Mauve","Cream"], subject="floral"
Output: {"title":"Wildflower Bloom Blanket","subtitle":"A tapestry crochet pattern in 4 soft floral tones"}`;

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------

function buildUserMessage(input: GenerateTitleInput): string {
  const colorCount = input.colorNames.length;
  const colorList = input.colorNames.join(', ') || 'unspecified';

  const lines = [
    `Color palette (${colorCount} color${colorCount !== 1 ? 's' : ''}): ${colorList}`,
    input.outputTypeLabel ? `Intended output type: ${input.outputTypeLabel}` : null,
    input.subjectHint ? `Image subject: ${input.subjectHint}` : null,
    input.imageDescription ? `User description: ${input.imageDescription}` : null,
  ].filter(Boolean);

  return `${lines.join('\n')}

Generate a creative pattern title and subtitle. Return ONLY the JSON object — no explanation, no markdown, no code fences.`;
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function buildFallback(input: GenerateTitleInput): PatternTitleResult {
  const count = input.colorNames.length;
  const outputLabel = input.outputTypeLabel?.trim() || 'Blanket';
  return {
    title: `Tapestry Crochet ${outputLabel}`,
    subtitle: `A tapestry crochet pattern in ${count} color${count !== 1 ? 's' : ''}`,
  };
}

// ---------------------------------------------------------------------------
// Exported wrapper function
// ---------------------------------------------------------------------------

export async function generateTitle(input: GenerateTitleInput): Promise<PatternTitleResult> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    console.warn('[titleGenerator] No API key configured — returning fallback');
    return buildFallback(input);
  }

  const google = createGoogleGenerativeAI({ apiKey });

  try {
    const { text } = await generateText({
      model: google(GEMINI_TEXT_MODEL),
      system: SYSTEM_PROMPT,
      prompt: buildUserMessage(input),
      maxOutputTokens: 80,
      temperature: 0.8,
    });

    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed: unknown = JSON.parse(cleaned);
    const result = PatternTitleSchema.safeParse(parsed);

    if (result.success) return result.data;

    console.warn('[titleGenerator] Schema validation failed:', result.error.issues);
    return buildFallback(input);
  } catch (error) {
    console.error('[titleGenerator] Error:', error instanceof Error ? error.message : error);
    return buildFallback(input);
  }
}
