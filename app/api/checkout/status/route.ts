import { kv } from '@vercel/kv';
import type { StoredCheckout } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return Response.json({ error: 'Missing session_id query parameter' }, { status: 400 });
  }

  const checkout = await kv.get<StoredCheckout>(`checkout:${sessionId}`);
  if (!checkout) {
    return Response.json({ error: 'Checkout session not found' }, { status: 404 });
  }

  return Response.json({
    status: checkout.status,
    downloadToken: checkout.status === 'complete' ? checkout.downloadToken : null,
  });
}
