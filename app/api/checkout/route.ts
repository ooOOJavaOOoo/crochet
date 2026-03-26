import { z } from 'zod';
import Stripe from 'stripe';
import { kv } from '@vercel/kv';
import type { StoredCheckout, StoredPattern } from '@/lib/types';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10' as Stripe.LatestApiVersion,
});

const schema = z.object({
  patternId: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { patternId } = parsed.data;

  const stored = await kv.get<StoredPattern>(`pattern:${patternId}`);
  if (!stored) {
    return Response.json({ error: 'Pattern not found' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error('[POST /api/checkout] NEXT_PUBLIC_APP_URL is not set');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Crochet Pattern PDF — Full Download' },
            unit_amount: 499,
          },
          quantity: 1,
        },
      ],
      metadata: { patternId },
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: appUrl,
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
    });
  } catch (err) {
    console.error('[POST /api/checkout] Stripe session creation failed', err);
    return Response.json({ error: 'Failed to create checkout session' }, { status: 502 });
  }

  if (!session.url) {
    return Response.json({ error: 'Stripe did not return a checkout URL' }, { status: 500 });
  }

  const storedCheckout: StoredCheckout = {
    patternId,
    stripeSessionId: session.id,
    status: 'pending',
    downloadToken: null,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`checkout:${session.id}`, storedCheckout, { ex: 7200 }); // 2 hours

  return Response.json({ checkoutUrl: session.url, sessionId: session.id }, { status: 200 });
}
