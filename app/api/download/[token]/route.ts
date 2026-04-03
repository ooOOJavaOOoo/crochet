import { jwtVerify } from 'jose';
import { kv } from '@vercel/kv';
import { put } from '@vercel/blob';
import type { StoredDownloadToken, StoredPattern } from '@/lib/types';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
import { renderStitchChart } from '@/lib/svg';
import { generatePatternPdf } from '@/lib/pdf';

export const runtime = 'nodejs';

function isAllowedBlobUrl(rawUrl: string): boolean {
  const allowlist = (process.env.BLOB_HOST_ALLOWLIST ?? 'blob.vercel-storage.com')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return false;
    }

    return allowlist.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const rateLimit = await checkRateLimit(_request, 'download');
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const { token } = await params;

  // 1. Verify JWT signature and expiry
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const secret = new TextEncoder().encode(jwtSecret);

  let sub: string | undefined;
  let jti: string | undefined;
  let pur: unknown;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    sub = payload.sub;
    jti = payload.jti;
    pur = (payload as Record<string, unknown>).pur;
  } catch (err) {
    console.warn('[GET /api/download] JWT verification failed', err instanceof Error ? err.message : err);
    return Response.json({ error: 'Invalid or expired token' }, { status: 403 });
  }

  // 2. Validate purpose claim
  if (pur !== 'download') {
    return Response.json({ error: 'Invalid token purpose' }, { status: 403 });
  }

  if (!jti || !sub) {
    return Response.json({ error: 'Malformed token claims' }, { status: 403 });
  }

  const lockKey = `download-lock:${jti}`;
  const lockResult = await kv.set(lockKey, '1', { nx: true, ex: 20 });
  if (lockResult !== 'OK') {
    return Response.json({ error: 'Download already in progress' }, { status: 429 });
  }

  // 3. Fetch one-time token record
  const tokenRecord = await kv.get<StoredDownloadToken>(`download:${jti}`);
  if (!tokenRecord) {
    await kv.del(lockKey);
    return Response.json({ error: 'Token not found' }, { status: 403 });
  }

  // 4. Check download limit (allow up to 3 attempts so interrupted downloads don't lock users out)
  const MAX_DOWNLOADS = 3;
  const currentCount = tokenRecord.downloadCount ?? (tokenRecord.used ? MAX_DOWNLOADS : 0);
  if (currentCount >= MAX_DOWNLOADS) {
    await kv.del(lockKey);
    return Response.json({ error: 'Download limit reached' }, { status: 403 });
  }

  // 5. Fetch pattern
  const storedPattern = await kv.get<StoredPattern>(`pattern:${sub}`);
  if (!storedPattern) {
    await kv.del(lockKey);
    return Response.json({ error: 'Pattern not found' }, { status: 404 });
  }

  let pdfBlobUrl = storedPattern.pdfBlobUrl;
  if (!pdfBlobUrl) {
    try {
      const chartSvg = renderStitchChart({
        stitchGrid: storedPattern.stitchGrid,
        sourceHintGrid: storedPattern.sourceHintGrid,
        palette: storedPattern.palette,
        preview: false,
      });

      const pdfBuffer = await generatePatternPdf({ pattern: storedPattern, chartSvg });
      const blob = await put(`patterns/${storedPattern.patternId}.pdf`, pdfBuffer, {
        access: 'public',
        contentType: 'application/pdf',
      });

      pdfBlobUrl = blob.url;
      await kv.set(`pattern:${storedPattern.patternId}`, { ...storedPattern, pdfBlobUrl }, { ex: 172800 });
    } catch (err) {
      console.error('[GET /api/download] PDF generation failed', err);
      await kv.del(lockKey);
      return Response.json({ error: 'Could not generate PDF' }, { status: 500 });
    }
  }

  if (!isAllowedBlobUrl(pdfBlobUrl)) {
    await kv.del(lockKey);
    return Response.json({ error: 'Invalid file URL' }, { status: 500 });
  }

  // 6. Increment download count BEFORE streaming (prevents parallel double-downloads)
  await kv.set(`download:${jti}`, { ...tokenRecord, used: currentCount + 1 >= MAX_DOWNLOADS, downloadCount: currentCount + 1 }, { ex: 86400 });

  // 7. Fetch PDF from Vercel Blob and stream to client
  let blobResponse: globalThis.Response;
  try {
    blobResponse = await fetch(pdfBlobUrl);
    if (!blobResponse.ok) {
      throw new Error(`Blob fetch failed: ${blobResponse.status}`);
    }
  } catch (err) {
    console.error('[GET /api/download] Blob fetch failed', err);
    await kv.del(lockKey);
    return Response.json({ error: 'Could not retrieve PDF' }, { status: 502 });
  }

  const patternId = storedPattern.patternId;

  await kv.del(lockKey);

  return new Response(blobResponse.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="crochet-pattern-${patternId}.pdf"`,
    },
  });
}
