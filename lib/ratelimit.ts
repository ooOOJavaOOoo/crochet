import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

const WINDOW_SECONDS = 60;
const REQUESTS_PER_WINDOW = 10;

const ratelimiter = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(REQUESTS_PER_WINDOW, `${WINDOW_SECONDS} s`),
  analytics: true,
  prefix: 'rl:api',
});

function getClientIp(request: Request): string {
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
  const ip = getClientIp(request);
  const { success, reset } = await ratelimiter.limit(`${routeKey}:${ip}`);

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
