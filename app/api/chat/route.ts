import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { GEMINI_TEXT_MODEL, getGoogleApiKey } from '@/lib/models';

export const runtime = 'edge';

export async function POST(request: Request) {
  const body = await request.json();

  if (!body?.messages) {
    return new Response(JSON.stringify({ error: 'messages field is required' }), {
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

  const result = streamText({
    model: google(GEMINI_TEXT_MODEL),
    messages: body.messages,
  });

  return result.toTextStreamResponse();
}
