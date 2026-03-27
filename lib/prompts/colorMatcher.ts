/**
 * Prompt 1: Color Naming & Yarn Matching
 *
 * Given an array of hex colors from image quantization, returns:
 * - A human-friendly color name
 * - A 1-sentence emotional/aesthetic tone
 * - The best matching yarn color from a known brand
 *
 * Model: gemini-3-flash-preview via @ai-sdk/google
 * Temperature: 0.3 (mostly factual, slight creativity for naming)
 * Max output tokens: 500
 */

import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { GEMINI_TEXT_MODEL, getGoogleApiKey } from '@/lib/models';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const ColorMatchSchema = z.object({
  colors: z.array(
    z.object({
      hex: z.string(),
      name: z.string(),
      tone: z.string(),
      yarnMatch: z.object({
        brand: z.string(),
        colorName: z.string(),
      }),
    })
  ),
});

export type ColorMatchResult = z.infer<typeof ColorMatchSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export type YarnBrand = 'lion-brand' | 'red-heart' | 'caron' | 'paintbox' | 'i-love-this-yarn';

export interface MatchColorsInput {
  hexColors: string[];
  yarnBrand?: YarnBrand;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a professional color analyst and yarn specialist for the craft industry. Analyze hex color values and return a single JSON object.

For each hex color:
1. Generate a 2–4 word human-friendly color name in Title Case — evocative and specific (e.g. "Warm Caramel", "Deep Espresso", "Misty Sage", "Dusty Blush", "Slate Storm")
2. Write exactly 1 sentence describing the emotional or aesthetic tone, max 15 words (e.g. "earthy and rustic with a cozy farmhouse warmth")
3. Select the best matching yarn color name from the specified brand (or best overall match if no brand given)

YARN BRAND COLOR KNOWLEDGE:

Lion Brand Pound of Love:
  Warm neutrals: Fisherman (off-white/cream), Butter (pale yellow), Caramel (medium tan), Taupe (grey-tan), Grey Marble (heathered grey)
  Brights: Lemon Yellow, Tangerine, Hot Pink, Cranberry, True Blue, Navy, Grass Green, Forest Green, Purple
  Classic: White, Black, Oxford Grey

Red Heart Super Saver:
  Light neutrals: Soft White, Aran (oatmeal), Light Linen, Buff (warm beige)
  Mid neutrals: Grey Heather, Taupe, Warm Brown, Cafe Latte
  Earth/jewel: Claret (deep wine-red), Burgundy, Amethyst, Teal, Jade, Wine
  Primary brights: Cherry Red, Royal Blue, Bright Yellow, Paddy Green, Bright Pink
  Pastels: Petal Pink, Baby Blue, Lavender, Mint
  Neons: Neon Green, Hot Coral

Caron Simply Soft:
  Soft neutral base: Bone (warm white), Off White, Black, Grey Heather
  Heathered: Soft Heather Rose, Ocean Heather, Purple Heather
  Muted midtones: Dark Sage, Muted Teal, Victorian Rose, Plum Wine, Persimmon, Autumn Maize
  Softened pastels: Light Country Peach, Soft Pink, Lavender Blue, Pistachio, Country Blue

Paintbox Simply DK:
  Pure saturated solids: Pillar Red, Blood Orange, Lipstick Pink, Daffodil Yellow, Banana Cream
  Bold brights: Grass Green, Racing Green, Spearmint Green, Melon Sorbet, Kingfisher Blue
  Clean tones: Pure Black, Pure White, Slate Grey, Ink Blue, Midnight Blue, Sailor Blue
  Accent: Violet Purple, Berry Red, Mustard Yellow, Tea Rose

I Love this Yarn:
  Neutrals: White, Black, Light Grey, Charcoal, Silver, Cream, Ivory, Beige, Tan
  Brights: Red, Dark Red, Crimson, Orange, Dark Orange, Yellow, Lime, Green
  Blues/Purples: Cyan, Sky Blue, Blue, Navy, Royal Blue, Lavender, Purple, Violet
  Accent: Pink, Hot Pink, Deep Pink, Rose, Plum, Magenta, Brown, Chocolate, Maroon

COLOR MATCHING LOGIC:
- Match hue family first (red · orange · yellow · green · blue · violet · neutral/brown · grey · white · black)
- Then match lightness tier (light · medium · dark)
- Near-white (lightness > 90%): Lion Brand → "Fisherman", Red Heart → "Soft White", Caron → "Bone", Paintbox → "Pure White", I Love this Yarn → "White"
- Near-black (lightness < 10%): all brands → "Black" (Paintbox → "Pure Black", I Love this Yarn → "Black")
- Warm grey → Lion Brand "Grey Marble", Red Heart "Grey Heather", Caron "Grey Heather", Paintbox "Slate Grey", I Love this Yarn "Light Grey"

OUTPUT RULES — read carefully:
- Return ONLY a valid JSON object. No markdown. No code fences. No explanation. No trailing commas.
- The "hex" field must echo the input hex string exactly, including the # symbol.
- Brand names must be the full readable name: "Lion Brand", "Red Heart", "Caron", "Paintbox", or "I Love this Yarn".
- Color names must be from the brand's known range above; do not invent SKU codes or fabricate product names.

EXAMPLE (2 colors, brand = Red Heart):
{"colors":[{"hex":"#C4A882","name":"Warm Caramel","tone":"earthy and rustic with a cozy farmhouse warmth","yarnMatch":{"brand":"Red Heart","colorName":"Cafe Latte"}},{"hex":"#5B3A29","name":"Deep Espresso","tone":"rich and grounded like freshly roasted dark coffee","yarnMatch":{"brand":"Red Heart","colorName":"Warm Brown"}}]}`;

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------

const BRAND_DISPLAY: Record<YarnBrand, string> = {
  'lion-brand': 'Lion Brand Pound of Love',
  'red-heart': 'Red Heart Super Saver',
  'caron': 'Caron Simply Soft',
  'paintbox': 'Paintbox Simply DK',
  'i-love-this-yarn': 'I Love this Yarn',
};

function buildUserMessage(input: MatchColorsInput): string {
  const brandLine = input.yarnBrand
    ? `Brand filter: ${BRAND_DISPLAY[input.yarnBrand]}. All yarn matches must come from this brand ONLY.`
    : `No brand filter. Choose the single best yarn match from any of: Lion Brand Pound of Love, Red Heart Super Saver, Caron Simply Soft, Paintbox Simply DK.`;

  return `Analyze the following ${input.hexColors.length} hex color(s) and return the JSON object.

Hex colors: ${input.hexColors.join(', ')}
${brandLine}

Return ONLY the JSON object — no explanation, no markdown, no code fences.`;
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function buildFallback(hexColors: string[]): ColorMatchResult {
  return {
    colors: hexColors.map((hex) => ({
      hex,
      name: 'Custom Color',
      tone: 'neutral and versatile, suitable for any decor style',
      yarnMatch: { brand: 'Red Heart', colorName: 'Soft White' },
    })),
  };
}

// ---------------------------------------------------------------------------
// Exported wrapper function
// ---------------------------------------------------------------------------

export async function matchColors(input: MatchColorsInput): Promise<ColorMatchResult> {
  if (!input.hexColors.length) return { colors: [] };

  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    console.warn('[colorMatcher] No API key configured — returning fallback');
    return buildFallback(input.hexColors);
  }

  const google = createGoogleGenerativeAI({ apiKey });

  try {
    const { text } = await generateText({
      model: google(GEMINI_TEXT_MODEL),
      system: SYSTEM_PROMPT,
      prompt: buildUserMessage(input),
      maxOutputTokens: 500,
      temperature: 0.3,
    });

    // Strip markdown code fences if the model adds them despite instructions
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed: unknown = JSON.parse(cleaned);
    const result = ColorMatchSchema.safeParse(parsed);

    if (result.success) return result.data;

    console.warn('[colorMatcher] Schema validation failed:', result.error.issues);
    return buildFallback(input.hexColors);
  } catch (error) {
    console.error('[colorMatcher] Error:', error instanceof Error ? error.message : error);
    return buildFallback(input.hexColors);
  }
}
