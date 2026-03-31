import type { PaletteEntry } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_SIZE     = 8;   // pixels per stitch cell
const LEGEND_HEIGHT = 68;  // pixels reserved below the chart
const ENTRY_W       = 96;  // pixels per legend entry (swatch + symbol + hex)
const LABEL_BAND_X  = 36;  // horizontal space for row numbers
const LABEL_BAND_Y  = 22;  // vertical space for column numbers
const LABEL_BAND_R  = 36;  // right-side gutter for row labels on the right edge

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface SvgChartOptions {
  stitchGrid: number[][];   // [row][col], row 0 = bottom-left
  palette: PaletteEntry[];
  preview?: boolean;        // if true: only render first 20 rows + teaser bar
  legendLimit?: number;
  showLegend?: boolean;
  rowLabelOffset?: number;
  colLabelOffset?: number;
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
  chartWidth: number,
  offsetX: number,
  offsetY: number,
): string {
  const entriesPerRow = Math.max(1, Math.floor(chartWidth / ENTRY_W));
  const rowHeight     = 30; // px per legend row
  const parts: string[] = [];

  palette.forEach((entry, i) => {
    const col  = i % entriesPerRow;
    const row  = Math.floor(i / entriesPerRow);
    const ex   = offsetX + col * ENTRY_W;
    const ey   = offsetY + 6 + row * rowHeight;
    const hexSafe = esc(entry.hex);
    const symSafe = esc(entry.symbol);

    parts.push(
      `<rect x="${ex}" y="${ey}" width="14" height="14" fill="${hexSafe}" stroke="#bfbfbf" stroke-width="0.7"/>`,
      `<text x="${ex + 17}" y="${ey + 11}" font-family="monospace" font-size="11" fill="#1f2937">${symSafe}</text>`,
      `<text x="${ex + 33}" y="${ey + 11}" font-family="monospace" font-size="9" fill="#374151">${hexSafe}</text>`,
    );
  });

  return parts.join('\n');
}

function getLegendHeight(entryCount: number, chartWidth: number): number {
  if (entryCount <= 0) return LEGEND_HEIGHT;
  const entriesPerRow = Math.max(1, Math.floor(chartWidth / ENTRY_W));
  const rows = Math.ceil(entryCount / entriesPerRow);
  return Math.max(LEGEND_HEIGHT, rows * 30 + 12);
}

function niceTickStep(minimum: number): number {
  if (minimum <= 1) return 1;

  const exponent = Math.floor(Math.log10(minimum));
  const base = 10 ** exponent;
  const normalized = minimum / base;

  if (normalized <= 1) return base;
  if (normalized <= 2) return 2 * base;
  if (normalized <= 5) return 5 * base;
  return 10 * base;
}

function shouldRenderTickLabel(index: number, total: number, step: number): boolean {
  if (index === 0 || index === total - 1) return true;
  return (index + 1) % step === 0;
}

function toColumnLabel(colIndex: number): string {
  let label = '';
  let n = colIndex + 1;

  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }

  return label;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderStitchChart(opts: SvgChartOptions): string {
  const {
    stitchGrid,
    palette,
    preview = false,
    legendLimit,
    showLegend = true,
    rowLabelOffset = 0,
    colLabelOffset = 0,
  } = opts;

  if (!stitchGrid.length || !stitchGrid[0].length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0" width="0" height="0"/>`;
  }

  const totalRows  = stitchGrid.length;
  const cols       = stitchGrid[0].length;
  const renderRows = preview ? Math.min(20, totalRows) : totalRows;
  const showAxisLabels = !preview;

  const chartX = showAxisLabels ? LABEL_BAND_X : 0;
  const chartY = showAxisLabels ? LABEL_BAND_Y : 0;
  const chartRightPad = showAxisLabels ? LABEL_BAND_R : 0;
  const chartHeight = renderRows * CELL_SIZE;
  const chartWidth  = cols * CELL_SIZE;
  const legendPalette = legendLimit === undefined ? palette : palette.slice(0, legendLimit);
  const legendHeight = showLegend
    ? preview
      ? LEGEND_HEIGHT
      : getLegendHeight(legendPalette.length, chartWidth)
    : 0;
  const legendY     = chartY + chartHeight + (showAxisLabels ? LABEL_BAND_Y : 0);
  const svgWidth    = chartX + chartWidth + chartRightPad;
  // Ensure top and bottom axis labels have sufficient breathing room (12px extra padding)
  const svgHeightBase = showLegend ? legendY + legendHeight : legendY;
  const svgHeight   = showAxisLabels ? svgHeightBase + 12 : svgHeightBase;

  const parts: string[] = [];

  if (showAxisLabels) {
    const colTickStep = niceTickStep(Math.max(Math.ceil(cols / 20), 1));
    const rowTickStep = niceTickStep(Math.max(Math.ceil(renderRows / 20), 1));

    // Axis label positioning with extra defensive padding to ensure visibility
    const topLabelY = chartY - 10;      // Extra 3px above the original -7 position
    const bottomLabelY = chartY + chartHeight + 16; // Extra 2px below the original +14 position

    parts.push(
      `<rect x="${chartX}" y="${chartY}" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" stroke="#d9d9d9" stroke-width="1"/>`,
    );

    for (let col = 0; col < cols; col++) {
      if (!shouldRenderTickLabel(col, cols, colTickStep)) continue;
      const label = toColumnLabel(col + colLabelOffset);
      const x = chartX + col * CELL_SIZE + CELL_SIZE / 2;

      parts.push(
        `<text x="${x}" y="${topLabelY}" font-family="monospace" font-size="10" font-weight="bold" fill="#2c3e50" text-anchor="middle">${label}</text>`,
        `<text x="${x}" y="${bottomLabelY}" font-family="monospace" font-size="10" font-weight="bold" fill="#2c3e50" text-anchor="middle">${label}</text>`,
      );
    }

    for (let row = 0; row < renderRows; row++) {
      if (!shouldRenderTickLabel(row, renderRows, rowTickStep)) continue;
      const label = String(row + 1 + rowLabelOffset);
      const y = chartY + (renderRows - 1 - row) * CELL_SIZE + CELL_SIZE / 2 + 3;

      parts.push(
        `<text x="${chartX - 8}" y="${y}" font-family="monospace" font-size="10" font-weight="bold" fill="#2c3e50" text-anchor="end">${label}</text>`,
        `<text x="${chartX + chartWidth + 8}" y="${y}" font-family="monospace" font-size="10" font-weight="bold" fill="#2c3e50" text-anchor="start">${label}</text>`,
      );
    }
  }

  // ── Stitch cells ──────────────────────────────────────────────────────────
  // row 0 = bottom of blanket → rendered at the BOTTOM of the SVG (high y)
  // SVG y=0 is the top, so row i → y = (renderRows - 1 - i) * CELL_SIZE
  for (let row = 0; row < renderRows; row++) {
    const y = chartY + (renderRows - 1 - row) * CELL_SIZE;
    for (let col = 0; col < cols; col++) {
      const pIdx = stitchGrid[row][col] ?? 0;
      const hex  = palette[pIdx]?.hex ?? '#CCCCCC';
      parts.push(
        `<rect x="${chartX + col * CELL_SIZE}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" fill="${esc(hex)}" shape-rendering="crispEdges"/>`,
      );
    }
  }

  // Light grid overlay keeps neighboring colors visually separable.
  for (let col = 1; col < cols; col++) {
    const x = chartX + col * CELL_SIZE;
    parts.push(
      `<line x1="${x}" y1="${chartY}" x2="${x}" y2="${chartY + chartHeight}" stroke="#d6dbe1" stroke-width="0.35" shape-rendering="crispEdges"/>`,
    );
  }

  for (let row = 1; row < renderRows; row++) {
    const y = chartY + row * CELL_SIZE;
    parts.push(
      `<line x1="${chartX}" y1="${y}" x2="${chartX + chartWidth}" y2="${y}" stroke="#d6dbe1" stroke-width="0.35" shape-rendering="crispEdges"/>`,
    );
  }

  // ── Footer: teaser bar (preview) or color legend (full) ──────────────────
  if (showLegend && preview) {
    parts.push(
      `<rect x="0" y="${legendY}" width="${svgWidth}" height="${legendHeight}" fill="#f5f5f5"/>`,
      `<text x="${svgWidth / 2}" y="${legendY + legendHeight / 2 + 6}" ` +
        `font-family="sans-serif" font-size="13" font-weight="bold" fill="#888" ` +
        `text-anchor="middle">` +
        `Pattern preview (${Math.min(renderRows, totalRows)} of ${totalRows} rows shown)` +
        `</text>`,
    );
  } else if (showLegend) {
    parts.push(renderLegend(legendPalette, chartWidth, chartX, legendY));
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" ` +
      `width="${svgWidth}" height="${svgHeight}" style="overflow: visible;">`,
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
