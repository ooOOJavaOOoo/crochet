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
  stylePreset: z.enum(['default', 'amigurumi-plush-3d']).optional(),
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
  'Create a crochet-friendly image with strong contrast, simplified color blocks, and crisp boundaries. Preserve semantic layer separation: major disjoint subjects must use clearly different color families, even if similar in brightness (for example, keep a face and the moon in different hues). Avoid blending unrelated objects into the same hue.';

const DEFAULT_IMAGE_EDIT_PROMPT =
  'Edit the provided source image instead of replacing it. Preserve the original subject identity, composition, pose, and key shapes unless the user explicitly asks to change them. Apply requested changes as localized edits while keeping the image crochet-friendly with strong contrast, simplified color blocks, and crisp boundaries.';

const AMIGURUMI_PLUSH_3D_PROMPT =
  'Create a 3D amigurumi-style toy-animal concept that looks soft and stuffable, with rounded plush volume, clean silhouette, and clear separate body parts (head, torso, limbs, ears, tail). Use beginner-friendly crochet cues: visible stitch texture, simple shaping, and seam-friendly transitions that could be assembled as a stuffed toy. Keep the design cute, front-facing or three-quarter view, and avoid photoreal fur, metallic materials, tiny hard-to-crochet details, or cluttered backgrounds.';

function buildPrompt(
  prompt: string | undefined,
  stylePreset: 'default' | 'amigurumi-plush-3d' | undefined,
  isEditMode: boolean
): string {
  const userPrompt = typeof prompt === 'string' && prompt.trim().length > 0 ? prompt.trim() : '';
  const basePresetPrompt = isEditMode
    ? DEFAULT_IMAGE_EDIT_PROMPT
    : stylePreset === 'amigurumi-plush-3d'
      ? AMIGURUMI_PLUSH_3D_PROMPT
      : DEFAULT_IMAGE_PROMPT;

  if (!userPrompt) {
    return basePresetPrompt;
  }

  return `${userPrompt}\n\nStyle requirements: ${basePresetPrompt}`;
}

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

    const { prompt, aspectRatio, sourceImage, stylePreset } = parsed.data;
    const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);
    const promptText = buildPrompt(prompt, stylePreset, Boolean(sourceImage));

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