import { kv } from '@vercel/kv';
import Stripe from 'stripe';
import { SignJWT } from 'jose';
import type { ShoppingListItem, StoredCheckout, StoredDownloadToken, StoredPattern } from '@/lib/types';
import { buildAmazonShoppingList } from '@/lib/shopping';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
import { buildClearCookie, parseCookies } from '@/lib/http';

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

async function getShoppingList(patternId: string): Promise<ShoppingListItem[] | null> {
  const pattern = await kv.get<StoredPattern>(`pattern:${patternId}`);
  if (!pattern) {
    return null;
  }

  return buildAmazonShoppingList(pattern);
}

export async function GET(request: Request): Promise<Response> {
  const rateLimit = await checkRateLimit(request, 'checkout-status');
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return Response.json({ error: 'Missing session_id query parameter' }, { status: 400 });
  }

  const cookies = parseCookies(request.headers.get('cookie'));
  const checkoutProof = cookies.checkout_proof;
  if (!checkoutProof) {
    return Response.json({ error: 'Missing checkout proof' }, { status: 403 });
  }

  const expectedProof = await kv.get<string>(`checkout-proof:${sessionId}`);
  if (!expectedProof || expectedProof !== checkoutProof) {
    return Response.json({ error: 'Invalid checkout proof' }, { status: 403 });
  }

  const checkoutKey = `checkout:${sessionId}`;
  const checkout = await kv.get<StoredCheckout>(checkoutKey);

  if (checkout?.status === 'complete') {
    const shoppingList = await getShoppingList(checkout.patternId);
    await kv.del(`checkout-proof:${sessionId}`);

    return Response.json({
      status: 'complete',
      downloadToken: checkout.downloadToken,
      shoppingList,
    }, {
      headers: {
        'set-cookie': buildClearCookie('checkout_proof'),
      },
    });
  }

  if (checkout?.status === 'expired') {
    return Response.json({ status: 'expired', downloadToken: null });
  }

  const stripe = getStripeClient();
  const jwtSecret = process.env.JWT_SECRET;

  // If Stripe/JWT are unavailable, return explicit error so the client can recover.
  if (!stripe || !jwtSecret) {
    return Response.json({ error: 'Server misconfiguration' }, { status: 503 });
  }

  let stripeSession: Stripe.Checkout.Session;
  try {
    stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('[GET /api/checkout/status] Stripe session lookup failed', err);
    return Response.json({ error: 'Temporary payment lookup failure' }, { status: 502 });
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

  const lockKey = `checkout-finalize-lock:${sessionId}`;
  const lockResult = await kv.set(lockKey, '1', { nx: true, ex: 30 });
  if (lockResult !== 'OK') {
    const completed = await kv.get<StoredCheckout>(checkoutKey);
    if (completed?.status === 'complete') {
      const shoppingList = await getShoppingList(completed.patternId);
      await kv.del(`checkout-proof:${sessionId}`);
      return Response.json({
        status: 'complete',
        downloadToken: completed.downloadToken,
        shoppingList,
      }, {
        headers: {
          'set-cookie': buildClearCookie('checkout_proof'),
        },
      });
    }

    return Response.json({ status: 'pending', downloadToken: null });
  }

  try {
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

    const shoppingList = await getShoppingList(patternId);
    await kv.del(`checkout-proof:${sessionId}`);

    return Response.json({
      status: finalized.status,
      downloadToken: finalized.downloadToken,
      shoppingList,
    }, {
      headers: {
        'set-cookie': buildClearCookie('checkout_proof'),
      },
    });
  } finally {
    await kv.del(lockKey);
  }
}
