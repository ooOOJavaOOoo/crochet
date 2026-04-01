import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { Resvg } from '@resvg/resvg-js';
import type { PatternData, PaletteEntry } from './types';
import { buildAmazonShoppingList } from './shopping';
import { getYarnWeightConfig } from './yarnWeight';
import { renderStitchChart } from './svg';
import { getOutputTypeLabel } from './outputType';

export interface PdfOptions {
  pattern: PatternData;
  chartSvg: string;
}

const PAGE_WIDTH = PageSizes.A4[0];  // 595.28
const PAGE_HEIGHT = PageSizes.A4[1]; // 841.89
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').padEnd(6, '0');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

function rleRow(row: number[], palette: PaletteEntry[]): string {
  if (row.length === 0) return '(empty)';
  const parts: string[] = [];
  let current = row[0];
  let count = 1;
  for (let i = 1; i < row.length; i++) {
    if (row[i] === current) {
      count++;
    } else {
      const sym = palette.find((p) => p.index === current)?.symbol ?? String(current);
      parts.push(`${count} ${sym}`);
      current = row[i];
      count = 1;
    }
  }
  const sym = palette.find((p) => p.index === current)?.symbol ?? String(current);
  parts.push(`${count} ${sym}`);
  return parts.join(', ');
}

function getInstructionColorKeyLine(entry: PaletteEntry): string {
  const resolvedColorName = entry.yarnColorName ?? entry.name ?? 'Unknown';
  const withBrand = entry.yarnBrand
    ? `${entry.yarnBrand} ${resolvedColorName}`
    : resolvedColorName;
  return `${entry.symbol} = ${withBrand} (${entry.hex})`;
}

function formatYards(yards: number): string {
  const rounded = Math.round(yards * 100) / 100;
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function resolveLegendBrand(pattern: PatternData): string | null {
  const brandCounts = new Map<string, number>();

  const addBrand = (brand?: string): void => {
    if (!brand) return;
    brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
  };

  for (const entry of pattern.inventory) {
    addBrand(entry.yarnBrand);
  }

  if (brandCounts.size === 0) {
    for (const paletteEntry of pattern.palette) {
      addBrand(paletteEntry.yarnBrand);
    }
  }

  if (brandCounts.size === 0) {
    return null;
  }

  return Array.from(brandCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = '...';
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, size);
  if (ellipsisWidth > maxWidth) return '';

  let out = text;
  while (out.length > 0 && font.widthOfTextAtSize(out, size) + ellipsisWidth > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}${ellipsis}`;
}

function computeFinishedSize(pattern: PatternData): { widthIn: number; heightIn: number } {
  const config = getYarnWeightConfig(pattern.yarnWeight);
  const { width, height } = pattern.dimensions;
  if (pattern.stitchType === 'c2c') {
    return {
      widthIn: width / config.c2cBlocksPerInch,
      heightIn: height / config.c2cBlocksPerInch,
    };
  }
  return {
    widthIn: width / config.tapestryStitchesPerInch,
    heightIn: height / config.tapestryRowsPerInch,
  };
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      // If a single word is wider than maxWidth, just push it as-is
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function getSvgViewBoxWidth(svg: string): number | null {
  const match = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (!match) return null;

  const parts = match[1]
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const width = parts[2];
  return width > 0 ? width : null;
}

export async function generatePatternPdf(opts: PdfOptions): Promise<Buffer> {
  const { pattern, chartSvg } = opts;
  const outputTypeLabel = getOutputTypeLabel(pattern.outputType ?? 'blanket', pattern.customOutputTypeLabel);
  const shoppingList = buildAmazonShoppingList(pattern);

  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);

  // Pre-render chart SVG to PNG once. A minimum raster width keeps labels and cells
  // crisp even for small patterns that are scaled up on the final chart page.
  const sourceChartWidth = getSvgViewBoxWidth(chartSvg) ?? pattern.dimensions.width * 8;
  // Keep preview sharp while capping memory use on serverless runtimes.
  const chartRasterWidth = Math.min(1800, Math.max(1200, Math.round(sourceChartWidth * 1.2)));
  const chartPngBuffer = new Resvg(chartSvg, {
    fitTo: {
      mode: 'width',
      value: chartRasterWidth,
    },
    font: {
      fontDirs: ['/fonts'],
      loadSystemFonts: true,
    },
  }).render().asPng();
  const chartPng = await doc.embedPng(chartPngBuffer);

  const footerText = `Pattern ID: ${pattern.patternId} — Generated by Crochet Canvas`;

  function newPage(): PDFPage {
    return doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  function drawFooter(page: PDFPage): void {
    page.drawText(footerText, {
      x: MARGIN,
      y: 18,
      size: 8,
      font: helvetica,
      color: gray,
    });
  }

  // ---------------------------------------------------------------------------
  // PAGE 1 — Title & Info
  // ---------------------------------------------------------------------------
  {
    const page = newPage();
    let y = PAGE_HEIGHT - MARGIN;

    // Thumbnail: stitch chart preview in the top-right corner
    const THUMB_MAX = 160;
    const thumbScale = Math.min(THUMB_MAX / chartPng.width, THUMB_MAX / chartPng.height, 1);
    const thumbW = chartPng.width * thumbScale;
    const thumbH = chartPng.height * thumbScale;
    const thumbX = PAGE_WIDTH - MARGIN - thumbW;
    const thumbY = PAGE_HEIGHT - MARGIN - thumbH;
    page.drawImage(chartPng, { x: thumbX, y: thumbY, width: thumbW, height: thumbH });
    // Thin border around thumbnail
    page.drawRectangle({
      x: thumbX,
      y: thumbY,
      width: thumbW,
      height: thumbH,
      borderColor: lightGray,
      borderWidth: 0.75,
    });
    page.drawText('Preview', {
      x: thumbX,
      y: thumbY - 11,
      size: 8,
      font: helvetica,
      color: gray,
    });

    // Left column width stops before the thumbnail
    const leftMaxX = thumbX - 16;
    const leftColWidth = leftMaxX - MARGIN;

    page.drawText(pattern.title, {
      x: MARGIN,
      y,
      size: 28,
      font: helveticaBold,
      color: black,
    });
    y -= 40;

    page.drawText(
      pattern.stitchType === 'c2c'
        ? `C2C ${outputTypeLabel} Pattern — ${getYarnWeightConfig(pattern.yarnWeight).label}`
        : pattern.stitchType === 'knitting'
        ? `${outputTypeLabel} Knitting Pattern — ${getYarnWeightConfig(pattern.yarnWeight).label}`
        : pattern.stitchType === 'cross-stitch'
        ? `${outputTypeLabel} Cross-Stitch Pattern — ${getYarnWeightConfig(pattern.yarnWeight).label}`
        : `Tapestry ${outputTypeLabel} Pattern — ${getYarnWeightConfig(pattern.yarnWeight).label}`,
      {
        x: MARGIN,
        y,
        size: 14,
        font: helvetica,
        color: gray,
        maxWidth: leftColWidth,
      },
    );
    y -= 36;

    page.drawText(
      `${outputTypeLabel} size: ${pattern.dimensions.width}W \u00d7 ${pattern.dimensions.height}H stitches`,
      { x: MARGIN, y, size: 12, font: helvetica, color: black },
    );
    y -= 22;

    // Finished physical dimensions
    const { widthIn, heightIn } = computeFinishedSize(pattern);
    const widthCm = widthIn * 2.54;
    const heightCm = heightIn * 2.54;
    const dimText =
      `Finished size: ${widthIn.toFixed(1)}" W \u00d7 ${heightIn.toFixed(1)}" H` +
      `  (${widthCm.toFixed(1)} cm \u00d7 ${heightCm.toFixed(1)} cm)`;
    page.drawText(dimText, { x: MARGIN, y, size: 12, font: helveticaBold, color: black });
    y -= 22;

    page.drawText(
      pattern.stitchType === 'c2c'
        ? `Gauge: ${getYarnWeightConfig(pattern.yarnWeight).c2cGaugeHint.split('. ')[1] ?? ''} Hook: ${pattern.hookSize}`
        : pattern.stitchType === 'knitting'
        ? `Gauge: ${getYarnWeightConfig(pattern.yarnWeight).knittingGaugeHint.split('. ')[1] ?? ''} Needle: ${pattern.hookSize}`
        : pattern.stitchType === 'cross-stitch'
        ? `${getYarnWeightConfig(pattern.yarnWeight).crossStitchGaugeHint} Fabric: ${pattern.hookSize}`
        : `Gauge: ${getYarnWeightConfig(pattern.yarnWeight).tapestryGaugeHint.split('. ')[1] ?? ''} Hook: ${pattern.hookSize}`,
      {
        x: MARGIN,
        y,
        size: 12,
        font: helvetica,
        color: black,
      },
    );
    y -= 22;

    const genDate = new Date(pattern.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    page.drawText(`Generated: ${genDate}`, {
      x: MARGIN,
      y,
      size: 12,
      font: helvetica,
      color: black,
    });

    drawFooter(page);
  }

  // ---------------------------------------------------------------------------
  // PAGE 2 — Color Legend & Yarn Inventory
  // ---------------------------------------------------------------------------
  {
    const page = newPage();
    let y = PAGE_HEIGHT - MARGIN;
    const legendBrand = resolveLegendBrand(pattern);
    const legendHeading = legendBrand
      ? `Color Legend & Yarn Requirements for ${legendBrand}`
      : 'Color Legend & Yarn Requirements';

    page.drawText(legendHeading, {
      x: MARGIN,
      y,
      size: 18,
      font: helveticaBold,
      color: black,
    });
    y -= 32;

    // Column X positions and widths
    const cols = {
      symbol:     MARGIN,
      colorName:  MARGIN + 50,
      stitches:   MARGIN + 280,
      yards:      MARGIN + 365,
      skeins:     MARGIN + 455,
    };

    const colWidths = {
      symbol: 50,
      colorName: 190,
      stitches: 85,
      yards: 90,
      skeins: 80,
    };

    // Header row background
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width: CONTENT_WIDTH,
      height: 18,
      color: lightGray,
    });

    const headers: Array<[keyof typeof cols, string]> = [
      ['symbol',     'Symbol'],
      ['colorName',  'Color Name'],
      ['stitches',   'Stitches'],
      ['yards',      'Yards'],
      ['skeins',     'Skeins'],
    ];

    for (const [key, label] of headers) {
      page.drawText(label, { x: cols[key], y, size: 9, font: helveticaBold, color: black });
    }
    y -= 22;

    for (const entry of pattern.inventory) {
      const pal = pattern.palette.find((p) => p.index === entry.paletteIndex);
      if (!pal) continue;

      // Color swatch before symbol
      const c = hexToRgb(pal.hex);
      page.drawRectangle({
        x: cols.symbol,
        y: y - 2,
        width: 10,
        height: 10,
        color: rgb(c.r, c.g, c.b),
        borderColor: gray,
        borderWidth: 0.5,
      });
      page.drawText(pal.symbol, {
        x: cols.symbol + 14,
        y,
        size: 9,
        font: helvetica,
        color: black,
      });

      const colorName = truncateToWidth(pal.name ?? 'Unknown', helvetica, 9, colWidths.colorName - 2);
      page.drawText(colorName, { x: cols.colorName, y, size: 9, font: helvetica, color: black });

      const stitchesText = entry.totalStitches.toLocaleString();
      page.drawText(stitchesText, {
        x: cols.stitches + colWidths.stitches - helvetica.widthOfTextAtSize(stitchesText, 9),
        y,
        size: 9,
        font: helvetica,
        color: black,
      });
      const yardsText = formatYards(entry.yardsNeeded);
      page.drawText(yardsText, {
        x: cols.yards + colWidths.yards - helvetica.widthOfTextAtSize(yardsText, 9),
        y,
        size: 9,
        font: helvetica,
        color: black,
      });
      const skeinsText = entry.skeinsNeeded.toLocaleString();
      page.drawText(skeinsText, {
        x: cols.skeins + colWidths.skeins - helvetica.widthOfTextAtSize(skeinsText, 9),
        y,
        size: 9,
        font: helvetica,
        color: black,
      });

      y -= 18;
    }

    y -= 16;
    page.drawText(
      '* Yardage estimates include 15% buffer. Worsted weight only. Buy one extra skein per color.',
      { x: MARGIN, y, size: 8, font: helvetica, color: gray },
    );

    drawFooter(page);
  }

  // ---------------------------------------------------------------------------
  // PAGE 3+ — Shopping List
  // ---------------------------------------------------------------------------
  {
    const itemsBySection = [
      {
        title: 'Yarn',
        items: shoppingList.filter((item) => item.category === 'yarn'),
      },
      {
        title: 'Tools',
        items: shoppingList.filter((item) => item.category === 'tool'),
      },
    ].filter((section) => section.items.length > 0);

    if (itemsBySection.length > 0) {
      const LINE_HEIGHT = 13;
      let page = newPage();
      let y = PAGE_HEIGHT - MARGIN;

      const drawShoppingHeader = (): void => {
        page.drawText('Shopping List', {
          x: MARGIN,
          y,
          size: 18,
          font: helveticaBold,
          color: black,
        });
        y -= 20;

        page.drawText(
          'Auto-generated from your yarn inventory and recommended tools.',
          {
            x: MARGIN,
            y,
            size: 9,
            font: helvetica,
            color: gray,
          },
        );
        y -= 22;
      };

      const beginNewShoppingPage = (): void => {
        drawFooter(page);
        page = newPage();
        y = PAGE_HEIGHT - MARGIN;
        drawShoppingHeader();
      };

      drawShoppingHeader();

      for (const section of itemsBySection) {
        if (y < MARGIN + LINE_HEIGHT * 5) {
          beginNewShoppingPage();
        }

        page.drawText(section.title, {
          x: MARGIN,
          y,
          size: 12,
          font: helveticaBold,
          color: black,
        });
        y -= 16;

        for (const item of section.items) {
          const qtyLine = `Qty: ${item.quantity} ${item.unit}`;
          const titleLines = wrapText(`- ${item.title}`, helvetica, 10, CONTENT_WIDTH);

          if (y < MARGIN + LINE_HEIGHT * (titleLines.length + 3)) {
            beginNewShoppingPage();
            page.drawText(section.title, {
              x: MARGIN,
              y,
              size: 12,
              font: helveticaBold,
              color: black,
            });
            y -= 16;
          }

          for (const line of titleLines) {
            page.drawText(line, {
              x: MARGIN,
              y,
              size: 10,
              font: helvetica,
              color: black,
            });
            y -= LINE_HEIGHT;
          }

          page.drawText(qtyLine, {
            x: MARGIN + 12,
            y,
            size: 9,
            font: helvetica,
            color: gray,
          });
          y -= LINE_HEIGHT;

          if (item.notes) {
            const noteLines = wrapText(item.notes, helvetica, 8, CONTENT_WIDTH - 12);
            for (const noteLine of noteLines) {
              if (y < MARGIN + LINE_HEIGHT) {
                beginNewShoppingPage();
                page.drawText(section.title, {
                  x: MARGIN,
                  y,
                  size: 12,
                  font: helveticaBold,
                  color: black,
                });
                y -= 16;
              }
              page.drawText(noteLine, {
                x: MARGIN + 12,
                y,
                size: 8,
                font: helvetica,
                color: gray,
              });
              y -= LINE_HEIGHT;
            }
          }

          y -= 4;
        }

        y -= 8;
      }

      drawFooter(page);
    }
  }

  // ---------------------------------------------------------------------------
  // PAGE N — Row-by-Row / Diagonal Instructions
  // ---------------------------------------------------------------------------
  {
    const ROWS_PER_PAGE = 50;
    const LINE_HEIGHT = 13;
    const totalRows = pattern.stitchGrid.length;
    const isC2C = pattern.stitchType === 'c2c';

    let page = newPage();
    let y = PAGE_HEIGHT - MARGIN;
    let rowsOnPage = 0;

    const drawInstructionPageHeader = (withColorKey: boolean): void => {
      page.drawText(
        isC2C ? 'C2C Diagonal Instructions (Bottom-Left to Top-Right)' : 'Row-by-Row Instructions (Bottom to Top)',
        {
          x: MARGIN,
          y,
          size: 18,
          font: helveticaBold,
          color: black,
        },
      );
      y -= 24;

      if (!withColorKey) {
        page.drawText('Continued', {
          x: MARGIN,
          y,
          size: 9,
          font: helvetica,
          color: gray,
        });
        y -= LINE_HEIGHT + 4;
        return;
      }

      page.drawText('Instruction Color Key (symbol = yarn brand + color):', {
        x: MARGIN,
        y,
        size: 9,
        font: helveticaBold,
        color: black,
      });
      y -= LINE_HEIGHT;

      for (const paletteEntry of pattern.palette) {
        const keyLine = getInstructionColorKeyLine(paletteEntry);
        const keyWrapped = wrapText(keyLine, helvetica, 9, CONTENT_WIDTH);
        for (const wrapped of keyWrapped) {
          page.drawText(wrapped, { x: MARGIN, y, size: 9, font: helvetica, color: gray });
          y -= LINE_HEIGHT;
        }
      }
      y -= 8;

      if (isC2C) {
        const noteLines = wrapText(
          'Work following the standard C2C method. Each entry below represents one diagonal row of blocks. ' +
          'Start at the bottom-left corner and progress diagonally. Each block = ch 3, join with sl st, ch 3, 3 dc in the ch-3 space. ' +
          'Refer to the stitch chart on the final page to follow the diagonal colour sequence.',
          helvetica,
          9,
          CONTENT_WIDTH,
        );
        for (const noteLine of noteLines) {
          page.drawText(noteLine, { x: MARGIN, y, size: 9, font: helvetica, color: gray });
          y -= LINE_HEIGHT;
        }
        y -= 8;
      }
    };

    drawInstructionPageHeader(true);

    for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
      const row = pattern.stitchGrid[rowIdx];
      const rleStr = rleRow(row, pattern.palette);
      const rowLabel = isC2C ? `Diagonal ${rowIdx + 1}` : `Row ${rowIdx + 1}`;
      const lineText = `${rowLabel}: ${rleStr}`;
      const wrappedLines = wrapText(lineText, helvetica, 9, CONTENT_WIDTH);
      const requiredHeight = wrappedLines.length * LINE_HEIGHT;

      if (rowsOnPage >= ROWS_PER_PAGE || y < MARGIN + requiredHeight + LINE_HEIGHT) {
        drawFooter(page);
        page = newPage();
        y = PAGE_HEIGHT - MARGIN;
        rowsOnPage = 0;
        drawInstructionPageHeader(false);
      }

      for (const wLine of wrappedLines) {
        page.drawText(wLine, { x: MARGIN, y, size: 9, font: helvetica, color: black });
        y -= LINE_HEIGHT;
      }
      rowsOnPage += 1;
    }

    drawFooter(page);
  }

  // ---------------------------------------------------------------------------
  // FINAL PAGE — Full Stitch Chart (single page with global row/column axes)
  // ---------------------------------------------------------------------------
  {
    const axisChartSvg = renderStitchChart({
      stitchGrid: pattern.stitchGrid,
      palette: pattern.palette,
      preview: false,
      showLegend: false,
      rowLabelOffset: 0,
      colLabelOffset: 0,
    });

    const page = newPage();
    let y = PAGE_HEIGHT - MARGIN;

    page.drawText('Full Stitch Chart', {
      x: MARGIN,
      y,
      size: 16,
      font: helveticaBold,
      color: black,
    });
    y -= 20;

    page.drawText(
      `Columns are numbered left to right. Rows are numbered bottom to top.`,
      {
        x: MARGIN,
        y,
        size: 9,
        font: helvetica,
        color: gray,
      },
    );
    y -= 14;

    page.drawText(
      `Chart range: columns 1-${pattern.dimensions.width} | rows 1-${pattern.dimensions.height}`,
      {
        x: MARGIN,
        y,
        size: 9,
        font: helvetica,
        color: gray,
      },
    );
    y -= 14;

    const maxW = CONTENT_WIDTH;
    const maxH = y - MARGIN - 20;

    // Render the full chart at high resolution so PDF zoom remains readable.
    const sourceAxisWidth = getSvgViewBoxWidth(axisChartSvg) ?? pattern.dimensions.width * 8;
    const chartWidthAt300Dpi = Math.ceil((maxW / 72) * 300);
    const fullChartRasterWidth = Math.min(
      7200,
      Math.max(2600, Math.round(Math.max(sourceAxisWidth * 2.6, chartWidthAt300Dpi * 2.4))),
    );

    const fullChartPngBuffer = new Resvg(axisChartSvg, {
      fitTo: {
        mode: 'width',
        value: fullChartRasterWidth,
      },
      font: {
        fontDirs: ['/fonts'],
        loadSystemFonts: true,
      },
    }).render().asPng();
    const fullChartPng = await doc.embedPng(fullChartPngBuffer);

    const scale = Math.min(maxW / fullChartPng.width, maxH / fullChartPng.height, 1);
    const drawW = fullChartPng.width * scale;
    const drawH = fullChartPng.height * scale;
    const chartX = MARGIN + (maxW - drawW) / 2;
    const chartY = y - drawH;

    page.drawImage(fullChartPng, {
      x: chartX,
      y: chartY,
      width: drawW,
      height: drawH,
    });

    page.drawRectangle({
      x: chartX,
      y: chartY,
      width: drawW,
      height: drawH,
      borderColor: lightGray,
      borderWidth: 0.75,
    });

    drawFooter(page);
  }

  return Buffer.from(await doc.save());
}
