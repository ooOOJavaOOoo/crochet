import { generateImage } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import {
  getGoogleVertexLocation,
  getGoogleVertexProject,
  IMAGEN_FAST_MODEL,
} from '@/lib/models';
import { ensureGoogleCredentialsFile } from '@/lib/googleCredentials.node';
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
          text: prompt,
          images: [sourceImage],
        }
      : prompt;

    const result = await generateImage({
      model: vertex.image(IMAGEN_FAST_MODEL),
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