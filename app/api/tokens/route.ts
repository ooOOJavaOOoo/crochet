import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildCrochetPrompt } from '@/lib/prompt';
import { GEMINI_TEXT_MODEL, getGoogleApiKey } from '@/lib/models';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';

// Gemini 2.5 Flash (text input) pricing in USD per 1M tokens.
// Keep these values aligned with the official Google AI pricing page.
const GEMINI_FLASH_INPUT_PRICE_PER_MILLION = 0.15;
const GEMINI_FLASH_INPUT_PRICE_PER_TOKEN = GEMINI_FLASH_INPUT_PRICE_PER_MILLION / 1_000_000;

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit(request, 'tokens');
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const body = await request.json();
    const {
      gridSize,
      colorLimit = 'auto',
      yarnBrand = '',
      yarnColors = '',
      allowAugmentedColors = false,
    } = body;

    const basePromptText = buildCrochetPrompt({
      gridSize,
      colorLimit,
      yarnBrand,
      yarnColors,
      allowAugmentedColors,
    });

    const image = body.image;
    const promptText = image
      ? `${basePromptText}\n\nImage (base64 data URI): ${image}`
      : basePromptText;

    if (promptText.length > 100_000) {
      return new Response(JSON.stringify({ error: 'Request payload too large.' }), {
        status: 413,
        headers: { 'content-type': 'application/json' },
      });
    }

    const apiKey = getGoogleApiKey();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Google API key is not configured.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: GEMINI_TEXT_MODEL });

    const tokens = await model.countTokens(promptText);

    const tokenCount = Number(tokens?.totalTokens ?? 0);
    const estimatedCost = tokenCount * GEMINI_FLASH_INPUT_PRICE_PER_TOKEN;

    return new Response(JSON.stringify({ tokenCount, estimatedCost }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Token count error', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}
