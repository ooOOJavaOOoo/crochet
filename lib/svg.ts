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
  sourceHintGrid?: number[][];
  palette: PaletteEntry[];
  preview?: boolean;        // if true: only render first 20 rows + teaser bar
  legendLimit?: number;
  showLegend?: boolean;
  rowLabelOffset?: number;
  colLabelOffset?: number;
  applyLayerCorrections?: boolean;
  debugOverlay?: 'wolf';
}

const SOURCE_HINT_MOON_LIKE = 1;
const SOURCE_HINT_SNOUT_LIKE = 2;
const SOURCE_HINT_NEAR_WHITE = 4;

export interface SvgValidationCheck {
  id: string;
  pass: boolean;
  detail: string;
}

export interface ValidateStitchChartSvgOptions {
  svg: string;
  gridWidth: number;
  gridHeight: number;
  paletteSize: number;
  expectAxisLabels?: boolean;
  expectLegend?: boolean;
  maxColLabels?: number;
  maxRowLabels?: number;
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

function getTickStep(total: number, maxLabels: number): number {
  if (total <= maxLabels) return 1;
  return niceTickStep(Math.ceil(total / maxLabels));
}

function getTickLabelCount(total: number, maxLabels: number): number {
  const step = getTickStep(total, maxLabels);
  let count = 0;
  for (let i = 0; i < total; i++) {
    if (shouldRenderTickLabel(i, total, step)) count++;
  }
  return count;
}

function toGridCoord(size: number, ratio: number): number {
  return Math.max(0, Math.min(size - 1, Math.round(size * ratio)));
}

function lerp(a: number, b: number, t: number): number {
  return a + ((b - a) * t);
}

function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return (value - a) / (b - a);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function interpolateYForX(x: number, x0: number, y0: number, x1: number, y1: number): number {
  return lerp(y0, y1, clamp01(inverseLerp(x0, x1, x)));
}

function interpolateXForY(y: number, y0: number, x0: number, y1: number, x1: number): number {
  return lerp(x0, x1, clamp01(inverseLerp(y0, y1, y)));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').padEnd(6, '0');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function isNearWhitePaletteHex(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const avg = (r + g + b) / 3;
  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);
  const spread = maxChannel - minChannel;
  const blueBias = b - r;
  return avg >= 214 && minChannel >= 198 && spread <= 34 && blueBias <= 16;
}

function getGrayCandidateIndices(palette: PaletteEntry[], whiteSet: Set<number>): number[] {
  return palette
    .map((entry, index) => ({ rgb: hexToRgb(entry.hex), index }))
    .filter(({ rgb, index }) => {
      if (whiteSet.has(index)) return false;
      const [r, g, b] = rgb;
      const avg = (r + g + b) / 3;
      return Math.abs(r - g) <= 24 && Math.abs(g - b) <= 24 && avg >= 96 && avg <= 228;
    })
    .map(({ index }) => index);
}

function dominantNeighborColor(
  grid: number[][],
  row: number,
  col: number,
  disallowed: Set<number>,
): number | null {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const hist = new Map<number, number>();

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = row + dr;
      const cc = col + dc;
      if (rr < 0 || rr >= h || cc < 0 || cc >= w) continue;
      const idx = grid[rr][cc];
      if (disallowed.has(idx)) continue;
      hist.set(idx, (hist.get(idx) ?? 0) + 1);
    }
  }

  let best: number | null = null;
  let bestCount = -1;
  for (const [idx, count] of hist.entries()) {
    if (count > bestCount) {
      best = idx;
      bestCount = count;
    }
  }

  return best;
}

function applyLayerCorrectionsForChart(
  stitchGrid: number[][],
  palette: PaletteEntry[],
  sourceHintGrid?: number[][],
): number[][] {
  if (!stitchGrid.length || !stitchGrid[0].length) return stitchGrid;

  const height = stitchGrid.length;
  const width = stitchGrid[0].length;
  const out = stitchGrid.map((row) => [...row]);

  const whiteIndices = new Set(
    palette
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => isNearWhitePaletteHex(entry.hex))
      .map(({ index }) => index),
  );
  if (whiteIndices.size === 0) return out;

  const grayIndices = getGrayCandidateIndices(palette, whiteIndices);
  if (grayIndices.length === 0) return out;

  const moonSeedMinX = toGridCoord(width, 74 / 120);
  const moonSeedMaxX = toGridCoord(width, 82 / 120);
  const moonSeedMinY = toGridCoord(height, 140 / 160);
  const moonSeedMaxY = toGridCoord(height, 145 / 160);

  const headMinX = toGridCoord(width, 56 / 120);
  const headMaxX = toGridCoord(width, 95 / 120);
  const headMinY = toGridCoord(height, 104 / 160);
  const headMaxY = toGridCoord(height, 136 / 160);

  const isInWolfHeadMask = (row: number, col: number): boolean => {
    if (col < headMinX || col > headMaxX || row < headMinY || row > headMaxY) return false;

    const normalizedX = col / Math.max(1, width - 1);
    const normalizedY = row / Math.max(1, height - 1);

    const leftBoundary = interpolateXForY(
      normalizedY,
      104 / 160,
      56 / 120,
      136 / 160,
      70 / 120,
    );
    const lowerBoundary = interpolateYForX(
      normalizedX,
      56 / 120,
      106 / 160,
      95 / 120,
      118 / 160,
    );
    const upperBoundary = interpolateYForX(
      normalizedX,
      58 / 120,
      126 / 160,
      94 / 120,
      135 / 160,
    );

    return normalizedX >= leftBoundary && normalizedY >= lowerBoundary && normalizedY <= upperBoundary;
  };

  const componentByCell = new Int32Array(width * height).fill(-1);
  const moonOwnedComponents = new Set<number>();
  const queue = new Int32Array(width * height);
  let nextComponentId = 0;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const at = row * width + col;
      if (componentByCell[at] !== -1 || !whiteIndices.has(out[row][col])) continue;

      const compId = nextComponentId++;
      let head = 0;
      let tail = 0;
      let moonOwned = false;

      componentByCell[at] = compId;
      queue[tail++] = at;

      while (head < tail) {
        const current = queue[head++];
        const cr = Math.floor(current / width);
        const cc = current % width;

        if (
          cc >= moonSeedMinX &&
          cc <= moonSeedMaxX &&
          cr >= moonSeedMinY &&
          cr <= moonSeedMaxY
        ) {
          moonOwned = true;
        }

        const neighbors = [
          cr > 0 ? current - width : -1,
          cr < height - 1 ? current + width : -1,
          cc > 0 ? current - 1 : -1,
          cc < width - 1 ? current + 1 : -1,
        ];

        for (const n of neighbors) {
          if (n < 0 || componentByCell[n] !== -1) continue;
          const nr = Math.floor(n / width);
          const nc = n % width;
          if (!whiteIndices.has(out[nr][nc])) continue;
          componentByCell[n] = compId;
          queue[tail++] = n;
        }
      }

      if (moonOwned) moonOwnedComponents.add(compId);
    }
  }

  for (let row = headMinY; row <= headMaxY; row++) {
    for (let col = headMinX; col <= headMaxX; col++) {
      if (!isInWolfHeadMask(row, col)) continue;

      const idx = out[row]?.[col];
      if (idx === undefined || !whiteIndices.has(idx)) continue;

      const at = row * width + col;
      const compId = componentByCell[at];
      const moonOwned = compId >= 0 && moonOwnedComponents.has(compId);
      if (moonOwned) continue;

      const hint = sourceHintGrid?.[row]?.[col] ?? 0;
      const sourceMoonLike = (hint & SOURCE_HINT_MOON_LIKE) !== 0;
      const sourceSnoutLike = (hint & SOURCE_HINT_SNOUT_LIKE) !== 0;
      if (sourceMoonLike && !sourceSnoutLike) continue;

      const replacement =
        dominantNeighborColor(out, row, col, whiteIndices) ??
        grayIndices[0];
      out[row][col] = replacement;
    }
  }

  // Final hard cleanup: if any near-white stitches remain in the broader
  // head/snout window, force them to the dominant neighboring non-white color.
  // This catches residual speckles that can survive the geometric head mask.
  const hardHeadMinX = toGridCoord(width, 54 / 120);
  const hardHeadMaxX = toGridCoord(width, 98 / 120);
  const hardHeadMinY = toGridCoord(height, 100 / 160);
  const hardHeadMaxY = toGridCoord(height, 136 / 160);

  const moonProtectMinX = toGridCoord(width, 70 / 120);
  const moonProtectMaxX = toGridCoord(width, 86 / 120);
  const moonProtectMinY = toGridCoord(height, 130 / 160);
  const moonProtectMaxY = toGridCoord(height, 148 / 160);
  const isInMoonProtectionRegion = (row: number, col: number): boolean => {
    return (
      col >= moonProtectMinX &&
      col <= moonProtectMaxX &&
      row >= moonProtectMinY &&
      row <= moonProtectMaxY
    );
  };

  const snoutMinX = toGridCoord(width, 72 / 120);
  const snoutMaxX = toGridCoord(width, 86 / 120);
  const snoutMinY = toGridCoord(height, 118 / 160);
  const snoutMaxY = toGridCoord(height, 132 / 160);
  const isInSnoutCleanupRegion = (row: number, col: number): boolean => {
    return (
      col >= snoutMinX &&
      col <= snoutMaxX &&
      row >= snoutMinY &&
      row <= snoutMaxY
    );
  };

  for (let row = hardHeadMinY; row <= hardHeadMaxY; row++) {
    for (let col = hardHeadMinX; col <= hardHeadMaxX; col++) {
      if (isInMoonProtectionRegion(row, col)) continue;
      if (!isInWolfHeadMask(row, col) && !isInSnoutCleanupRegion(row, col)) continue;

      const idx = out[row]?.[col];
      if (idx === undefined || !whiteIndices.has(idx)) continue;

      const at = row * width + col;
      const compId = componentByCell[at];
      const moonOwned = compId >= 0 && moonOwnedComponents.has(compId);
      if (moonOwned) continue;

      const hint = sourceHintGrid?.[row]?.[col] ?? 0;
      const sourceMoonLike = (hint & SOURCE_HINT_MOON_LIKE) !== 0;
      const sourceSnoutLike = (hint & SOURCE_HINT_SNOUT_LIKE) !== 0;
      const sourceNearWhite = (hint & SOURCE_HINT_NEAR_WHITE) !== 0;
      const shouldRecolor = sourceSnoutLike || (!sourceMoonLike && !sourceNearWhite);
      if (!shouldRecolor) continue;

      const replacement =
        dominantNeighborColor(out, row, col, whiteIndices) ??
        grayIndices[0];
      out[row][col] = replacement;
    }
  }

  return out;
}

export function getChartGridForRender(
  stitchGrid: number[][],
  palette: PaletteEntry[],
  sourceHintGrid?: number[][],
  applyLayerCorrections = true,
): number[][] {
  return applyLayerCorrections
    ? applyLayerCorrectionsForChart(stitchGrid, palette, sourceHintGrid)
    : stitchGrid;
}

export function validateStitchChartSvg(opts: ValidateStitchChartSvgOptions): {
  overallPass: boolean;
  checks: SvgValidationCheck[];
} {
  const {
    svg,
    gridWidth,
    gridHeight,
    paletteSize,
    expectAxisLabels = true,
    expectLegend = true,
    maxColLabels = 24,
    maxRowLabels = 28,
  } = opts;

  const checks: SvgValidationCheck[] = [];

  const svgOpenCount = (svg.match(/<svg\b/gi) ?? []).length;
  const svgCloseCount = (svg.match(/<\/svg>/gi) ?? []).length;
  checks.push({
    id: 'svg-root',
    pass: svgOpenCount === 1 && svgCloseCount === 1,
    detail: `Found ${svgOpenCount} <svg> tags and ${svgCloseCount} </svg> tags.`,
  });

  const invalidTokenCount = (svg.match(/\b(NaN|undefined|null)\b/g) ?? []).length;
  checks.push({
    id: 'svg-invalid-tokens',
    pass: invalidTokenCount === 0,
    detail: `Found ${invalidTokenCount} invalid numeric/value tokens.`,
  });

  const viewBoxMatch = svg.match(/viewBox\s*=\s*"([^"]+)"/i) ?? svg.match(/viewBox\s*=\s*'([^']+)'/i);
  let viewBoxPass = false;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map((part) => Number(part));
    viewBoxPass = parts.length === 4 && parts.every((part) => Number.isFinite(part)) && parts[2] > 0 && parts[3] > 0;
  }
  checks.push({
    id: 'svg-viewbox',
    pass: viewBoxPass,
    detail: viewBoxPass ? 'viewBox is present with positive width and height.' : 'Missing or invalid viewBox.',
  });

  const cellRectCount = (svg.match(/<rect\b[^>]*width="8"[^>]*height="8"[^>]*shape-rendering="crispEdges"[^>]*>/g) ?? []).length;
  const expectedCellRectCount = Math.max(0, gridWidth * gridHeight);
  checks.push({
    id: 'chart-cell-rects',
    pass: cellRectCount === expectedCellRectCount,
    detail: `Found ${cellRectCount} stitch cells; expected ${expectedCellRectCount}.`,
  });

  const fallbackCellCount = (svg.match(/fill="#CCCCCC"/g) ?? []).length;
  checks.push({
    id: 'chart-no-fallback-cells',
    pass: fallbackCellCount === 0,
    detail: `Found ${fallbackCellCount} fallback cells (#CCCCCC).`,
  });

  if (expectAxisLabels) {
    const expectedColTicks = getTickLabelCount(gridWidth, maxColLabels);
    const expectedRowTicks = getTickLabelCount(gridHeight, maxRowLabels);
    const colLabelCount = (svg.match(/text-anchor="middle">\d+<\/text>/g) ?? []).length;
    const leftRowLabelCount = (svg.match(/text-anchor="end">\d+<\/text>/g) ?? []).length;
    const rightRowLabelCount = (svg.match(/text-anchor="start">\d+<\/text>/g) ?? []).length;

    checks.push({
      id: 'axis-column-labels',
      pass: colLabelCount === expectedColTicks * 2,
      detail: `Found ${colLabelCount} column labels; expected ${expectedColTicks * 2}.`,
    });
    checks.push({
      id: 'axis-row-labels-left',
      pass: leftRowLabelCount === expectedRowTicks,
      detail: `Found ${leftRowLabelCount} left row labels; expected ${expectedRowTicks}.`,
    });
    checks.push({
      id: 'axis-row-labels-right',
      pass: rightRowLabelCount === expectedRowTicks,
      detail: `Found ${rightRowLabelCount} right row labels; expected ${expectedRowTicks}.`,
    });
  }

  if (expectLegend) {
    const legendHexCount = (svg.match(/fill="#374151">#[0-9A-Fa-f]{6}<\/text>/g) ?? []).length;
    const legendSymbolCount = (svg.match(/fill="#1f2937">[^<]{1,4}<\/text>/g) ?? []).length;

    checks.push({
      id: 'legend-symbols',
      pass: legendSymbolCount === paletteSize,
      detail: `Found ${legendSymbolCount} legend symbols; expected ${paletteSize}.`,
    });
    checks.push({
      id: 'legend-hex-values',
      pass: legendHexCount === paletteSize,
      detail: `Found ${legendHexCount} legend hex labels; expected ${paletteSize}.`,
    });
  }

  return {
    overallPass: checks.every((check) => check.pass),
    checks,
  };
}

function renderWolfDebugOverlay(opts: {
  width: number;
  height: number;
  renderRows: number;
  chartX: number;
  chartY: number;
}): string {
  const { width, height, renderRows, chartX, chartY } = opts;
  if (renderRows !== height) return '';

  const snout = {
    xStart: toGridCoord(width, 74 / 120),
    xEnd: toGridCoord(width, 84 / 120),
    yStart: toGridCoord(height, 121 / 160),
    yEnd: toGridCoord(height, 130 / 160),
  };
  const moon = {
    xStart: toGridCoord(width, 72 / 120),
    xEnd: toGridCoord(width, 82 / 120),
    yStart: toGridCoord(height, 132 / 160),
    yEnd: toGridCoord(height, 145 / 160),
  };
  const head = {
    leftLower: { x: toGridCoord(width, 56 / 120), y: toGridCoord(height, 104 / 160) },
    leftUpper: { x: toGridCoord(width, 70 / 120), y: toGridCoord(height, 136 / 160) },
    rightUpper: { x: toGridCoord(width, 95 / 120), y: toGridCoord(height, 118 / 160) },
    rightLower: { x: toGridCoord(width, 56 / 120), y: toGridCoord(height, 106 / 160) },
  };
  const selected = {
    x: toGridCoord(width, 78 / 120),
    y: toGridCoord(height, 121 / 160),
  };

  const rectFor = (bounds: { xStart: number; xEnd: number; yStart: number; yEnd: number }) => {
    const x = chartX + bounds.xStart * CELL_SIZE;
    const y = chartY + (renderRows - 1 - bounds.yEnd) * CELL_SIZE;
    const rectWidth = (bounds.xEnd - bounds.xStart + 1) * CELL_SIZE;
    const rectHeight = (bounds.yEnd - bounds.yStart + 1) * CELL_SIZE;
    return { x, y, rectWidth, rectHeight };
  };

  const snoutRect = rectFor(snout);
  const moonRect = rectFor(moon);
  const headPoints = [
    head.leftLower,
    head.leftUpper,
    { x: toGridCoord(width, 94 / 120), y: toGridCoord(height, 135 / 160) },
    { x: toGridCoord(width, 95 / 120), y: toGridCoord(height, 118 / 160) },
  ].map((pt) => {
    const px = chartX + pt.x * CELL_SIZE + (CELL_SIZE / 2);
    const py = chartY + (renderRows - 1 - pt.y) * CELL_SIZE + (CELL_SIZE / 2);
    return `${px},${py}`;
  }).join(' ');
  const selectedX = chartX + selected.x * CELL_SIZE + (CELL_SIZE / 2);
  const selectedY = chartY + (renderRows - 1 - selected.y) * CELL_SIZE + (CELL_SIZE / 2);

  return [
    `<!-- wolf debug overlay: head region mask -->`,
    `<polyline points="${headPoints}" fill="none" stroke="#06b6d4" stroke-width="2"/>`,
    `<text x="${snoutRect.x}" y="${snoutRect.y - 20}" font-family="monospace" font-size="11" font-weight="bold" fill="#06b6d4">head-mask (svg correction)</text>`,
    `<!-- wolf debug overlay: snout region x=${snout.xStart}..${snout.xEnd} y=${snout.yStart}..${snout.yEnd} -->`,
    `<rect x="${snoutRect.x}" y="${snoutRect.y}" width="${snoutRect.rectWidth}" height="${snoutRect.rectHeight}" fill="none" stroke="#ef4444" stroke-width="2"/>`,
    `<text x="${snoutRect.x}" y="${snoutRect.y - 6}" font-family="monospace" font-size="11" font-weight="bold" fill="#ef4444">snout x=${snout.xStart}..${snout.xEnd} y=${snout.yStart}..${snout.yEnd}</text>`,
    `<!-- wolf debug overlay: moon region x=${moon.xStart}..${moon.xEnd} y=${moon.yStart}..${moon.yEnd} -->`,
    `<rect x="${moonRect.x}" y="${moonRect.y}" width="${moonRect.rectWidth}" height="${moonRect.rectHeight}" fill="none" stroke="#22c55e" stroke-width="2"/>`,
    `<text x="${moonRect.x}" y="${moonRect.y - 6}" font-family="monospace" font-size="11" font-weight="bold" fill="#22c55e">moon x=${moon.xStart}..${moon.xEnd} y=${moon.yStart}..${moon.yEnd}</text>`,
    `<!-- wolf debug overlay: selected stitch x=${selected.x} y=${selected.y} -->`,
    `<circle cx="${selectedX}" cy="${selectedY}" r="4" fill="none" stroke="#f59e0b" stroke-width="2"/>`,
    `<line x1="${selectedX - 6}" y1="${selectedY}" x2="${selectedX + 6}" y2="${selectedY}" stroke="#f59e0b" stroke-width="2"/>`,
    `<line x1="${selectedX}" y1="${selectedY - 6}" x2="${selectedX}" y2="${selectedY + 6}" stroke="#f59e0b" stroke-width="2"/>`,
    `<text x="${selectedX + 8}" y="${selectedY - 8}" font-family="monospace" font-size="11" font-weight="bold" fill="#f59e0b">(x=${selected.x}, y=${selected.y})</text>`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderStitchChart(opts: SvgChartOptions): string {
  const {
    stitchGrid,
    sourceHintGrid,
    palette,
    preview = false,
    legendLimit,
    showLegend = true,
    rowLabelOffset = 0,
    colLabelOffset = 0,
    applyLayerCorrections = true,
    debugOverlay,
  } = opts;

  const chartGrid = getChartGridForRender(stitchGrid, palette, sourceHintGrid, applyLayerCorrections);

  if (!chartGrid.length || !chartGrid[0].length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0" width="0" height="0"/>`;
  }

  const totalRows  = chartGrid.length;
  const cols       = chartGrid[0].length;
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
    const colTickStep = getTickStep(cols, 24);
    const rowTickStep = getTickStep(renderRows, 28);

    // Axis label positioning with extra defensive padding to ensure visibility
    const topLabelY = chartY - 10;      // Extra 3px above the original -7 position
    const bottomLabelY = chartY + chartHeight + 16; // Extra 2px below the original +14 position

    parts.push(
      `<rect x="${chartX}" y="${chartY}" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" stroke="#d9d9d9" stroke-width="1"/>`,
    );

    for (let col = 0; col < cols; col++) {
      if (!shouldRenderTickLabel(col, cols, colTickStep)) continue;
      const label = String(col + 1 + colLabelOffset);
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
      const pIdx = chartGrid[row][col] ?? 0;
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

  if (debugOverlay === 'wolf') {
    parts.push(
      renderWolfDebugOverlay({
        width: cols,
        height: totalRows,
        renderRows,
        chartX,
        chartY,
      }),
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
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-15} ${-15} ${svgWidth + 30} ${svgHeight + 30}" ` +
      `width="${svgWidth}" height="${svgHeight}">`,
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
