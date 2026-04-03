import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const verifyUrl = process.env.VERIFY_URL || 'http://localhost:3000/api/verify/wolf';
const baseUrl = process.env.APP_URL || 'http://localhost:3000';
const patternId = process.env.PATTERN_ID;
const outputPath = process.env.WOLF_SVG_OUT || 'fixtures/wolf-debug.svg';
const debugOverlay = process.env.DEBUG_OVERLAY || 'wolf';

async function main() {
  const urlWithSvg = patternId
    ? `${baseUrl}/api/debug/chart-svg?patternId=${encodeURIComponent(patternId)}&debugOverlay=${encodeURIComponent(debugOverlay)}`
    : `${verifyUrl}${verifyUrl.includes('?') ? '&' : '?'}includeSvg=1&debugOverlay=${encodeURIComponent(debugOverlay)}`;

  const response = await fetch(urlWithSvg, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Expected JSON from ${urlWithSvg}, received non-JSON response.`);
  }

  if (!response.ok) {
    throw new Error(`Verification endpoint failed (${response.status}): ${payload.error || 'Unknown error'}`);
  }

  if (typeof payload.chartSvg !== 'string' || payload.chartSvg.length === 0) {
    throw new Error('Verification payload did not include chartSvg.');
  }

  const absoluteOutput = path.resolve(process.cwd(), outputPath);
  await mkdir(path.dirname(absoluteOutput), { recursive: true });
  await writeFile(absoluteOutput, payload.chartSvg, 'utf8');

  console.log(`Wrote debug SVG to ${absoluteOutput}`);
  console.log(`Source endpoint: ${urlWithSvg}`);
  console.log(`Source mode: ${patternId ? 'stored-pattern (matches PDF path)' : 'verify-wolf (diagnostic)'}`);
  const gridW = payload.params?.gridWidth ?? payload.dimensions?.width ?? 'unknown';
  const gridH = payload.params?.gridHeight ?? payload.dimensions?.height ?? 'unknown';
  console.log(`Grid: ${gridW} x ${gridH}`);
  console.log(`Palette count: ${payload.paletteCount}`);
}

main().catch((error) => {
  process.exitCode = 1;
  console.error('Failed to export wolf SVG:', error instanceof Error ? error.message : error);
});
