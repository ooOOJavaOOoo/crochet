import type { PaletteEntry } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_SIZE     = 8;   // pixels per stitch cell
const LEGEND_HEIGHT = 60;  // pixels reserved below the chart
const ENTRY_W       = 80;  // pixels per legend entry (swatch + symbol + hex)
const ROW_LABEL_INTERVAL = 10;

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface SvgChartOptions {
  stitchGrid: number[][];   // [row][col], row 0 = bottom-left
  palette: PaletteEntry[];
  preview?: boolean;        // if true: only render first 20 rows + teaser bar
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLegend(
  palette: PaletteEntry[],
  svgWidth: number,
  offsetY: number,
): string {
  const entriesPerRow = Math.max(1, Math.floor(svgWidth / ENTRY_W));
  const rowHeight     = 26; // px per legend row
  const parts: string[] = [];

  palette.forEach((entry, i) => {
    const col  = i % entriesPerRow;
    const row  = Math.floor(i / entriesPerRow);
    const ex   = col * ENTRY_W;
    const ey   = offsetY + 6 + row * rowHeight;
    const hexSafe = esc(entry.hex);
    const symSafe = esc(entry.symbol);

    parts.push(
      `<rect x="${ex}" y="${ey}" width="12" height="12" fill="${hexSafe}" stroke="#ccc" stroke-width="0.5"/>`,
      `<text x="${ex + 14}" y="${ey + 10}" font-family="monospace" font-size="10" fill="#333">${symSafe}</text>`,
      `<text x="${ex + 26}" y="${ey + 10}" font-family="monospace" font-size="8"  fill="#666">${hexSafe}</text>`,
    );
  });

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderStitchChart(opts: SvgChartOptions): string {
  const { stitchGrid, palette, preview = false } = opts;

  if (!stitchGrid.length || !stitchGrid[0].length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0" width="0" height="0"/>`;
  }

  const totalRows  = stitchGrid.length;
  const cols       = stitchGrid[0].length;
  const renderRows = preview ? Math.min(20, totalRows) : totalRows;

  const chartHeight = renderRows * CELL_SIZE;
  const svgWidth    = cols * CELL_SIZE;
  const svgHeight   = chartHeight + LEGEND_HEIGHT;

  const parts: string[] = [];

  // ── Stitch cells ──────────────────────────────────────────────────────────
  // row 0 = bottom of blanket → rendered at the BOTTOM of the SVG (high y)
  // SVG y=0 is the top, so row i → y = (renderRows - 1 - i) * CELL_SIZE
  for (let row = 0; row < renderRows; row++) {
    const y = (renderRows - 1 - row) * CELL_SIZE;
    for (let col = 0; col < cols; col++) {
      const pIdx = stitchGrid[row][col] ?? 0;
      const hex  = palette[pIdx]?.hex ?? '#CCCCCC';
      parts.push(
        `<rect x="${col * CELL_SIZE}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" fill="${esc(hex)}"/>`,
      );
    }
  }

  // ── Row number labels (every 10th row) ───────────────────────────────────
  for (let row = 0; row < renderRows; row++) {
    if (row % ROW_LABEL_INTERVAL === 0) {
      const y = (renderRows - 1 - row) * CELL_SIZE;
      parts.push(
        `<text x="-2" y="${y + CELL_SIZE}" font-family="sans-serif" font-size="6" text-anchor="end" fill="#666">${row}</text>`,
      );
    }
  }

  // ── Footer: teaser bar (preview) or color legend (full) ──────────────────
  if (preview) {
    parts.push(
      `<rect x="0" y="${chartHeight}" width="${svgWidth}" height="${LEGEND_HEIGHT}" fill="#f5f5f5"/>`,
      `<text x="${svgWidth / 2}" y="${chartHeight + LEGEND_HEIGHT / 2 + 6}" ` +
        `font-family="sans-serif" font-size="13" font-weight="bold" fill="#888" ` +
        `text-anchor="middle">` +
        `Purchase to see all ${totalRows} rows` +
        `</text>`,
    );
  } else {
    parts.push(renderLegend(palette, svgWidth, chartHeight));
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" ` +
      `width="${svgWidth}" height="${svgHeight}" overflow="visible">`,
    ...parts,
    `</svg>`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------------

export function renderPreviewChart(opts: Omit<SvgChartOptions, 'preview'>): string {
  return renderStitchChart({ ...opts, preview: true });
}
