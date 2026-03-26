import { generateImage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getGoogleApiKey, IMAGEN_FAST_MODEL } from '@/lib/models';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, 'image');
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  try {
    const body = await request.json();
    const { prompt, aspectRatio, sourceImage } = body;

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'prompt is required.' }), {
        status: 400,
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

    const google = createGoogleGenerativeAI({ apiKey });

    const imagePrompt = sourceImage
      ? {
          text: prompt,
          images: [sourceImage],
        }
      : prompt;

    const result = await generateImage({
      model: google.image(IMAGEN_FAST_MODEL),
      prompt: imagePrompt,
      n: 1,
      ...(aspectRatio ? { aspectRatio } : {}),
    });

    const image = result.image;
    const dataUrl = `data:${image.mediaType};base64,${image.base64}`;

    return new Response(
      JSON.stringify({
        image: dataUrl,
        mediaType: image.mediaType,
        model: IMAGEN_FAST_MODEL,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Image generation error', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}