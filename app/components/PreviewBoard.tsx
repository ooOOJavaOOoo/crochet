'use client';

import type { PatternData } from '@/lib/types';
import QualityWarningsList from './QualityWarningsList';

interface PreviewData {
  patternId: string;
  title: string;
  previewSvg: string;
  colorLegend: Array<{
    symbol: string;
    hex: string;
    name?: string;
    yarnBrand?: string;
    yarnColorName?: string;
  }>;
  totalLegendCount: number;
  hiddenLegendCount: number;
  totalRows: number;
  isWatermarked: boolean;
}

interface PreviewBoardProps {
  imageBase64: string | null;
  previewData: PreviewData | null;
  patternData: PatternData | null;
  loadingMessage: string | null;
  onCheckout: () => Promise<void>;
  onAdjustWarning: (sectionId: string) => void;
}

export default function PreviewBoard({
  imageBase64,
  previewData,
  patternData,
  loadingMessage,
  onCheckout,
  onAdjustWarning,
}: PreviewBoardProps) {
  const activeQualityWarnings = patternData?.qualityWarnings ?? [];
  const qaFlags = patternData?.qaFlags ?? [];
  const qualityMetrics = patternData?.qualityMetrics;
  const warningList = Array.from(new Set(activeQualityWarnings));

  const getYarnDisplayName = (item: {
    yarnBrand?: string;
    yarnColorName?: string;
    name?: string;
  }): string => {
    if (item.yarnBrand && item.yarnColorName) {
      return `${item.yarnBrand} - ${item.yarnColorName}`;
    }
    if (item.yarnColorName) {
      return item.yarnColorName;
    }
    return item.name ?? 'Unnamed color';
  };

  return (
    <section className="space-y-6">
      {/* Source Image Preview */}
      <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-secondary)]">Preview board</p>
            <h2 className="font-display mt-1 text-2xl font-semibold text-[color:var(--foreground)]">See the chart before you buy</h2>
          </div>
          <div className="rounded-full bg-[color:var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-secondary)]">
            Watermarked sample
          </div>
        </div>

        {/* Quality Warnings */}
        {warningList.length > 0 && (
          <QualityWarningsList
            warnings={warningList}
            qaFlags={[]}
            onAdjustClick={onAdjustWarning}
          />
        )}

        {/* Image Preview */}
        {imageBase64 ? (
          <div className="preview-frame relative h-72 w-full rounded-[1.5rem] p-3">
            <img
              src={imageBase64}
              alt="Source preview"
              className="h-full w-full rounded-[1.1rem] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            <div
              className="absolute inset-3 rounded-[1.1rem]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(90,72,56,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(90,72,56,0.15) 1px, transparent 1px)',
                backgroundSize: '12px 12px',
                backgroundPosition: '0 0, 0 0',
                pointerEvents: 'none',
              }}
            />
          </div>
        ) : (
          <div className="preview-frame flex min-h-72 items-center justify-center rounded-[1.5rem] px-6 text-center text-sm leading-6 text-[color:var(--text-secondary)]">
            Your uploaded image preview appears here once you add a photo.
          </div>
        )}
      </div>

      {/* Generated Chart Preview */}
      {previewData && (
        <>
          {/* Chart Display */}
          <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-semibold text-[color:var(--foreground)]">
                {previewData.title}
              </h3>
              <div className="mono-meta rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                {previewData.totalRows} rows in chart
              </div>
            </div>

            <div className="preview-frame relative h-[min(65vh,460px)] rounded-[1.5rem] p-3">
              <div
                className="flex h-full w-full items-center justify-center rounded-[1rem] bg-white/70 p-2 [&>svg]:block [&>svg]:h-auto [&>svg]:max-h-full [&>svg]:max-w-full [&>svg]:w-auto"
                dangerouslySetInnerHTML={{ __html: previewData.previewSvg }}
              />
              {previewData.isWatermarked && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rotate-[-18deg] text-3xl font-black uppercase tracking-[0.18em] text-[color:var(--foreground)]/20 sm:text-5xl">
                    Preview Only
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Color Legend */}
          <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[color:var(--foreground)]">
                  Color legend
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
                  Preview includes {previewData.colorLegend.length} of {previewData.totalLegendCount} colors.
                  {previewData.hiddenLegendCount > 0
                    ? ` Purchase the PDF to unlock the remaining ${previewData.hiddenLegendCount} colors and full yarn inventory.`
                    : ' Purchase the PDF to unlock the complete pattern and yarn inventory.'}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
                  Final PDF includes both formats: a full stitch chart grid and written row-by-row instructions.
                </p>
              </div>
              <div className="flex -space-x-2">
                {previewData.colorLegend.slice(0, 5).map((entry, index) => (
                  <span
                    key={`${entry.symbol}-${index}`}
                    className="swatch-dot !h-6 !w-6"
                    style={{ backgroundColor: entry.hex }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-[1.25rem] border border-[color:var(--border-soft)] bg-white/70">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[color:var(--surface-subtle)]/80 text-[color:var(--text-secondary)]">
                  <tr>
                    <th className="px-4 py-3">Color</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Yarn Color</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.colorLegend.map((entry, index) => (
                    <tr
                      key={`${entry.symbol}-${entry.hex}-${index}`}
                      className="border-t border-[color:var(--border-soft)]/60"
                    >
                      <td className="px-4 py-3">
                        <span
                          className="inline-block h-6 w-6 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: entry.hex }}
                          aria-label={`Color ${entry.hex}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-[color:var(--foreground)]">
                        {entry.symbol}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                        {getYarnDisplayName(entry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* QA Metrics */}
          <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
            <h3 className="font-display text-2xl font-semibold text-[color:var(--foreground)]">
              Pre-checkout QA
            </h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              Automated checks run on every generated chart to catch readability risks before purchase.
            </p>

            {qualityMetrics && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                    Duplicate colors
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
                    {Math.round(qualityMetrics.duplicateColorRatio * 100)}%
                  </p>
                </div>
                <div className="rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                    Fragmentation
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
                    {Math.round(qualityMetrics.flatRegionFragmentation * 100)}%
                  </p>
                </div>
                <div className="rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                    Sky/tree continuity
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
                    {qualityMetrics.skyTreeContinuityScore}
                  </p>
                </div>
              </div>
            )}

            {qaFlags.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-4 py-3">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  Flags to review before checkout:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--foreground)]">
                  {qaFlags.map((flag, index) => (
                    <li key={`${flag}-${index}`}>{flag}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-white/70 px-4 py-3 text-sm text-[color:var(--text-secondary)]">
                No critical QA flags detected for this chart.
              </p>
            )}
          </div>

          {/* Checkout Button */}
          <button
            type="button"
            onClick={onCheckout}
            disabled={loadingMessage !== null}
            className="success-button w-full rounded-[1.4rem] px-6 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Buy PDF Pattern
          </button>
        </>
      )}
    </section>
  );
}
