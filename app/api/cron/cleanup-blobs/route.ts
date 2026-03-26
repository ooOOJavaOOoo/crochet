import { list, del } from '@vercel/blob';

export const runtime = 'nodejs';

const BLOB_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

export async function GET(request: Request): Promise<Response> {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = Date.now() - BLOB_MAX_AGE_MS;
  let deleted = 0;
  let cursor: string | undefined;

  // Page through all blobs under patterns/ prefix
  do {
    const result = await list({
      prefix: 'patterns/',
      ...(cursor ? { cursor } : {}),
    });

    const stale = result.blobs.filter(
      (b) => b.uploadedAt instanceof Date && b.uploadedAt.getTime() < cutoff,
    );

    if (stale.length > 0) {
      await Promise.all(stale.map((b) => del(b.url)));
      deleted += stale.length;
    }

    cursor = result.cursor;
  } while (cursor);

  console.info(`[cron/cleanup-blobs] Deleted ${deleted} stale blob(s)`);

  return Response.json({ deleted });
}
