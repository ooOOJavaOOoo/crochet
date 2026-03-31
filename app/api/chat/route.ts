import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { GEMINI_TEXT_MODEL, getGoogleApiKey } from '@/lib/models';
import { z } from 'zod';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';

export const runtime = 'edge';

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1).max(4000),
    }),
  ).min(1).max(30),
});

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, 'chat');
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { messages } = parsed.data;

  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Google API key is not configured.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const google = createGoogleGenerativeAI({ apiKey });

  const result = streamText({
    model: google(GEMINI_TEXT_MODEL),
    messages,
  });

  return result.toTextStreamResponse();
}
