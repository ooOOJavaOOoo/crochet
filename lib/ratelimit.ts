import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_REQUESTS_PER_WINDOW = 10;

const ROUTE_LIMITS: Record<string, { requests: number; windowSeconds: number }> = {
  'checkout-status': { requests: 90, windowSeconds: 60 },
  checkout: { requests: 20, windowSeconds: 60 },
  download: { requests: 30, windowSeconds: 60 },
  chat: { requests: 30, windowSeconds: 60 },
};

const kvConfigured =
  !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

function createLimiter(routeKey: string): Ratelimit {
  const config = ROUTE_LIMITS[routeKey] ?? {
    requests: DEFAULT_REQUESTS_PER_WINDOW,
    windowSeconds: DEFAULT_WINDOW_SECONDS,
  };

  return new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(config.requests, `${config.windowSeconds} s`),
    analytics: true,
    prefix: `rl:api:${routeKey}`,
  });
}

function getClientIp(request: Request): string {
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

export type RateLimitCheck = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export async function checkRateLimit(request: Request, routeKey: string): Promise<RateLimitCheck> {
  if (!kvConfigured) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const ratelimiter = createLimiter(routeKey);
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? 'na';
  const fallbackEntropy = ip === 'unknown' ? userAgent.slice(0, 80) : ip;
  const { success, reset } = await ratelimiter.limit(`${routeKey}:${fallbackEntropy}`);

  if (success) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { allowed: false, retryAfterSeconds };
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please retry later.' }),
    {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(retryAfterSeconds),
      },
    },
  );
}
