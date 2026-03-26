import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { buildCrochetPrompt } from '@/lib/prompt';
import { GEMINI_TEXT_MODEL, getGoogleApiKey } from '@/lib/models';

/**
 * @deprecated Legacy free-form text generation route.
 * The production pattern pipeline uses POST /api/pattern + /api/preview.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      image,
      gridSize,
      colorLimit = 'auto',
      yarnBrand = '',
      yarnColors = '',
      allowAugmentedColors = false,
    } = body;

    const apiKey = getGoogleApiKey();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Google API key is not configured.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const prompt = buildCrochetPrompt({
      gridSize,
      colorLimit,
      yarnBrand,
      yarnColors,
      allowAugmentedColors,
    });

    const promptText = image ? `${prompt}\n\nImage (base64 data URI): ${image}` : prompt;

    const result = await generateText({
      model: google(GEMINI_TEXT_MODEL),
      prompt: promptText,
      maxOutputTokens: 2500,
      temperature: 0.2,
    });

    const pattern = result.text?.trim() || 'No pattern generated.';

    return new Response(JSON.stringify({ pattern }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        warning: '299 - Deprecated API: use /api/pattern instead of /api/generate',
      },
    });
  } catch (error) {
    console.error('Generate error', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}
