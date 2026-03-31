import { generateImage } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import {
  getGoogleVertexLocation,
  getGoogleVertexProject,
  IMAGEN_FAST_MODEL,
} from '@/lib/models';
import { ensureGoogleCredentialsFile } from '@/lib/googleCredentials.node';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
import { z } from 'zod';

const schema = z.object({
  prompt: z.string().max(1000).optional(),
  aspectRatio: z.union([z.string().max(20), z.number().positive().max(10)]).optional(),
  sourceImage: z.string().max(15_000_000).optional(),
});

type ImagenAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

const IMAGEN_ASPECT_RATIOS: Array<{ ratio: ImagenAspectRatio; value: number }> = [
  { ratio: '1:1', value: 1 },
  { ratio: '3:4', value: 3 / 4 },
  { ratio: '4:3', value: 4 / 3 },
  { ratio: '9:16', value: 9 / 16 },
  { ratio: '16:9', value: 16 / 9 },
];

const DEFAULT_IMAGE_PROMPT =
  'Create a crochet-friendly image with strong contrast and simplified color blocks.';

function normalizeAspectRatio(input: unknown): ImagenAspectRatio | undefined {
  if (typeof input === 'string') {
    if (IMAGEN_ASPECT_RATIOS.some((item) => item.ratio === input)) {
      return input as ImagenAspectRatio;
    }

    const numericValue = Number(input);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return undefined;
    }

    input = numericValue;
  }

  if (typeof input !== 'number' || !Number.isFinite(input) || input <= 0) {
    return undefined;
  }

  return IMAGEN_ASPECT_RATIOS.reduce((closest, current) => {
    const currentDistance = Math.abs(current.value - input);
    const closestDistance = Math.abs(closest.value - input);
    return currentDistance < closestDistance ? current : closest;
  }).ratio;
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, 'image');
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.issues }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const { prompt, aspectRatio, sourceImage } = parsed.data;
    const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);
    const promptText =
      typeof prompt === 'string' && prompt.trim().length > 0 ? prompt.trim() : DEFAULT_IMAGE_PROMPT;

    const project = getGoogleVertexProject();
    if (!project) {
      return new Response(JSON.stringify({ error: 'Google Vertex project is not configured.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    ensureGoogleCredentialsFile();

    const location = getGoogleVertexLocation();

    const vertex = createVertex({ project, location });

    const imagePrompt = sourceImage
      ? {
          text: promptText,
          images: [sourceImage],
        }
      : promptText;

    const result = await generateImage({
      model: vertex.image(IMAGEN_FAST_MODEL),
      prompt: imagePrompt,
      n: 1,
      ...(normalizedAspectRatio ? { aspectRatio: normalizedAspectRatio } : {}),
    });

    const image = result.image;
    const dataUrl = `data:${image.mediaType};base64,${image.base64}`;

    return new Response(
      JSON.stringify({
        image: dataUrl,
        mediaType: image.mediaType,
        model: IMAGEN_FAST_MODEL,
        provider: 'google-vertex',
        location,
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