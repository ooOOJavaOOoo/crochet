import Stripe from 'stripe';
import { SignJWT } from 'jose';
import { kv } from '@vercel/kv';
import type { StoredCheckout, StoredDownloadToken } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: '2024-04-10' as Stripe.LatestApiVersion,
  });
}

export async function POST(request: Request): Promise<Response> {
  const stripe = getStripeClient();
  if (!stripe) {
    console.error('[POST /api/webhooks/stripe] STRIPE_SECRET_KEY is not set');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[POST /api/webhooks/stripe] STRIPE_WEBHOOK_SECRET is not set');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('[POST /api/webhooks/stripe] JWT_SECRET is not set');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return Response.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret,
    );
  } catch (err) {
    console.error('[POST /api/webhooks/stripe] Signature verification failed', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Invalid signature' },
      { status: 400 },
    );
  }

  if (event.type !== 'checkout.session.completed') {
    // Acknowledge unhandled events silently
    return Response.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const patternId = session.metadata?.patternId;

  if (!patternId) {
    console.error('[stripe webhook] checkout.session.completed missing patternId metadata', {
      sessionId: session.id,
    });
    return Response.json({ received: true });
  }

  // Idempotency check — skip if already processed
  const existing = await kv.get<StoredCheckout>(`checkout:${session.id}`);
  if (existing?.status === 'complete') {
    return Response.json({ received: true });
  }

  // Generate one-time download JWT
  const secret = new TextEncoder().encode(jwtSecret);
  const jti = crypto.randomUUID();

  const token = await new SignJWT({ sub: patternId, pur: 'download' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);

  const issuedAt = new Date().toISOString();

  const downloadTokenRecord: StoredDownloadToken = {
    patternId,
    jti,
    issuedAt,
    used: false,
  };

  const updatedCheckout: StoredCheckout = {
    patternId,
    stripeSessionId: session.id,
    status: 'complete',
    downloadToken: token,
    createdAt: existing?.createdAt ?? issuedAt,
  };

  // Persist both records
  await Promise.all([
    kv.set(`download:${jti}`, downloadTokenRecord, { ex: 86400 }),          // 24 hours
    kv.set(`checkout:${session.id}`, updatedCheckout, { ex: 86400 }),       // 24 hours
  ]);

  return Response.json({ received: true });
}
