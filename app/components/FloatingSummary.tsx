'use client';

import type { OutputType } from '@/lib/types';
import { getOutputTypeLabel } from '@/lib/outputType';

const HERO_SWATCHES = [
  { name: 'Terracotta Thread', hex: '#b85c38' },
  { name: 'Oat Gold', hex: '#d89e58' },
  { name: 'Moss Loop', hex: '#35624a' },
  { name: 'Denim Stitch', hex: '#2e5e8a' },
  { name: 'Walnut Warmth', hex: '#6f4f3a' },
];

interface FloatingSummaryProps {
  outputType: OutputType;
  customOutputTypeLabel: string;
  gridWidth: number;
  gridHeight: number;
  colorCount: number;
  isGenerating: boolean;
  onDismiss?: () => void;
}

export default function FloatingSummary({
  outputType,
  customOutputTypeLabel,
  gridWidth,
  gridHeight,
  colorCount,
  isGenerating,
  onDismiss,
}: FloatingSummaryProps) {
  const resolvedOutputTypeLabel = getOutputTypeLabel(outputType, customOutputTypeLabel);

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:hidden z-30 drop-shadow-lg"
      role="region"
      aria-label="Current pattern summary"
      aria-live="polite"
    >
      <div className="crochet-card rounded-2xl p-4 bg-white/95 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 text-sm flex-1">
            <div>
              <p className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)] font-semibold">
                Output type
              </p>
              <p className="font-semibold text-[color:var(--foreground)]">{resolvedOutputTypeLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)] font-semibold">
                Grid size
              </p>
              <p className="font-semibold text-[color:var(--foreground)]">
                {gridWidth} × {gridHeight}
              </p>
            </div>
          </div>

          <div className="text-right space-y-2 flex-shrink-0">
            {/* Color swatches showing color count */}
            <div className="flex flex-wrap gap-1 justify-end">
              {HERO_SWATCHES.slice(0, Math.min(colorCount, HERO_SWATCHES.length)).map((c) => (
                <span
                  key={c.name}
                  className="h-4 w-4 rounded-full border border-white/50 flex-shrink-0"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  aria-label={`${c.name}`}
                />
              ))}
            </div>

            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs text-[color:var(--text-secondary)] hover:underline font-semibold block w-full text-center"
                aria-label="Dismiss summary"
              >
                Hide
              </button>
            )}

            {isGenerating && (
              <div className="text-xs text-[color:var(--brand-secondary)] font-semibold animate-pulse">
                Generating...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
