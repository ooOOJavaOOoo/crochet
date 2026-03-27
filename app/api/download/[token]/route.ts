import { jwtVerify } from 'jose';
import { kv } from '@vercel/kv';
import type { StoredDownloadToken, StoredPattern } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;

  // 1. Verify JWT signature and expiry
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

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

  // 3. Fetch one-time token record
  const tokenRecord = await kv.get<StoredDownloadToken>(`download:${jti}`);
  if (!tokenRecord) {
    return Response.json({ error: 'Token not found' }, { status: 403 });
  }

  // 4. Check download limit (allow up to 3 attempts so interrupted downloads don't lock users out)
  const MAX_DOWNLOADS = 3;
  const currentCount = tokenRecord.downloadCount ?? (tokenRecord.used ? MAX_DOWNLOADS : 0);
  if (currentCount >= MAX_DOWNLOADS) {
    return Response.json({ error: 'Download limit reached' }, { status: 403 });
  }

  // 5. Fetch pattern
  const storedPattern = await kv.get<StoredPattern>(`pattern:${sub}`);
  if (!storedPattern) {
    return Response.json({ error: 'Pattern not found' }, { status: 404 });
  }

  // 6. Increment download count BEFORE streaming (prevents parallel double-downloads)
  await kv.set(`download:${jti}`, { ...tokenRecord, used: currentCount + 1 >= MAX_DOWNLOADS, downloadCount: currentCount + 1 }, { ex: 86400 });

  // 7. Fetch PDF from Vercel Blob and stream to client
  let blobResponse: globalThis.Response;
  try {
    blobResponse = await fetch(storedPattern.pdfBlobUrl);
    if (!blobResponse.ok) {
      throw new Error(`Blob fetch failed: ${blobResponse.status}`);
    }
  } catch (err) {
    console.error('[GET /api/download] Blob fetch failed', err);
    // Best-effort: restore count so user can retry
    await kv.set(`download:${jti}`, { ...tokenRecord, used: false, downloadCount: currentCount }, { ex: 86400 });
    return Response.json({ error: 'Could not retrieve PDF' }, { status: 502 });
  }

  const patternId = storedPattern.patternId;

  return new Response(blobResponse.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="crochet-pattern-${patternId}.pdf"`,
    },
  });
}
