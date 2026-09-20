import { Resvg } from '@resvg/resvg-js';
import type { MetadataRoute } from 'next';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  // Simple SVG template sized for 1200x630 social preview.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="100%" height="100%" fill="#fff6f2" />
    <rect x="60" y="60" width="1080" height="510" rx="28" fill="#ffffff" stroke="#f2e6de" />
    <text x="120" y="220" fill="#2e5e8a" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="700" font-size="64">Crochet Canvas</text>
    <text x="120" y="300" fill="#6f4f3a" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="28">Turn a photo into a stitch-ready crochet chart</text>
    <g transform="translate(820,160) scale(0.9)">
      <rect x="0" y="0" width="240" height="240" rx="20" fill="#b85c38" />
      <text x="24" y="130" fill="#fff" font-family="Space Mono, monospace" font-size="40">CC</text>
    </g>
  </svg>`;

  // Try to render PNG using resvg. If unavailable in the environment, return SVG fallback.
  try {
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: 1200,
      },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    const uint = new Uint8Array(pngBuffer);
    return new Response(uint, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }
}

export default GET;
