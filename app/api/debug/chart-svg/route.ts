import { kv } from '@vercel/kv';
import { renderStitchChart } from '@/lib/svg';
import type { StoredPattern } from '@/lib/types';

export const runtime = 'nodejs';

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return Math.min(max, Math.max(min, rounded));
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const patternId = url.searchParams.get('patternId');
    const debugOverlay = url.searchParams.get('debugOverlay') === 'wolf' ? 'wolf' : undefined;
    if (!patternId) {
      return Response.json({ error: 'Missing patternId query parameter' }, { status: 400 });
    }

    const storedPattern = await kv.get<StoredPattern>(`pattern:${patternId}`);
    if (!storedPattern) {
      return Response.json({ error: 'Pattern not found' }, { status: 404 });
    }

    // Keep chart generation aligned with /api/download/[token] so QA can inspect
    // the same SVG data that is used as PDF input.
    const chartSvg = renderStitchChart({
      stitchGrid: storedPattern.stitchGrid,
      sourceHintGrid: storedPattern.sourceHintGrid,
      palette: storedPattern.palette,
      preview: false,
      debugOverlay,
    });

    const maxLen = parseBoundedInt(url.searchParams.get('maxLen'), 0, 0, 5_000_000);

    return Response.json(
      {
        patternId,
        source: 'stored-pattern',
        dimensions: storedPattern.dimensions,
        paletteCount: storedPattern.palette.length,
        chartSvg: maxLen > 0 ? chartSvg.slice(0, maxLen) : chartSvg,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[GET /api/debug/chart-svg] failed', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
