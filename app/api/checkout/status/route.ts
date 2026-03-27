import { kv } from '@vercel/kv';
import Stripe from 'stripe';
import { SignJWT } from 'jose';
import type { StoredCheckout, StoredDownloadToken } from '@/lib/types';

export const runtime = 'nodejs';

function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: '2024-04-10' as Stripe.LatestApiVersion,
  });
}

async function finalizeCheckout(
  sessionId: string,
  patternId: string,
  createdAt: string,
  jwtSecret: string,
): Promise<{ status: 'complete'; downloadToken: string }> {
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
    stripeSessionId: sessionId,
    status: 'complete',
    downloadToken: token,
    createdAt,
  };

  await Promise.all([
    kv.set(`download:${jti}`, downloadTokenRecord, { ex: 86400 }),
    kv.set(`checkout:${sessionId}`, updatedCheckout, { ex: 86400 }),
  ]);

  return { status: 'complete', downloadToken: token };
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return Response.json({ error: 'Missing session_id query parameter' }, { status: 400 });
  }

  const checkoutKey = `checkout:${sessionId}`;
  const checkout = await kv.get<StoredCheckout>(checkoutKey);

  if (checkout?.status === 'complete') {
    return Response.json({
      status: 'complete',
      downloadToken: checkout.downloadToken,
    });
  }

  if (checkout?.status === 'expired') {
    return Response.json({ status: 'expired', downloadToken: null });
  }

  const stripe = getStripeClient();
  const jwtSecret = process.env.JWT_SECRET;

  // If Stripe/JWT are unavailable, fall back to existing pending record only.
  if (!stripe || !jwtSecret) {
    if (checkout) {
      return Response.json({ status: 'pending', downloadToken: null });
    }

    return Response.json({ error: 'Checkout session not found' }, { status: 404 });
  }

  let stripeSession: Stripe.Checkout.Session;
  try {
    stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('[GET /api/checkout/status] Stripe session lookup failed', err);
    if (checkout) {
      return Response.json({ status: 'pending', downloadToken: null });
    }
    return Response.json({ error: 'Checkout session not found' }, { status: 404 });
  }

  if (stripeSession.status === 'expired') {
    const patternId = checkout?.patternId ?? stripeSession.metadata?.patternId;
    if (patternId) {
      const expiredCheckout: StoredCheckout = {
        patternId,
        stripeSessionId: sessionId,
        status: 'expired',
        downloadToken: null,
        createdAt: checkout?.createdAt ?? new Date().toISOString(),
      };
      await kv.set(checkoutKey, expiredCheckout, { ex: 86400 });
    }

    return Response.json({ status: 'expired', downloadToken: null });
  }

  if (stripeSession.payment_status !== 'paid') {
    return Response.json({ status: 'pending', downloadToken: null });
  }

  const patternId = checkout?.patternId ?? stripeSession.metadata?.patternId;
  if (!patternId) {
    return Response.json({ error: 'Missing pattern metadata on checkout session' }, { status: 500 });
  }

  const finalized = await finalizeCheckout(
    sessionId,
    patternId,
    checkout?.createdAt ?? new Date().toISOString(),
    jwtSecret,
  );

  return Response.json({
    status: finalized.status,
    downloadToken: finalized.downloadToken,
  });
}
