'use client';

interface QualityWarningsListProps {
  warnings: string[];
  qaFlags: string[];
  onAdjustClick: (targetSectionId: string) => void;
}

// Mapping of warning text to adjustable settings
const ADJUSTMENT_MAP: Record<string, { sectionId: string; label: string }> = {
  'Low color count flattens details': { sectionId: 'color-count-slider', label: 'Increase colors' },
  'Very low color counts can flatten details': {
    sectionId: 'color-count-slider',
    label: 'Increase colors',
  },
  'High fragmentation': { sectionId: 'flatten-background', label: 'Enable flatten regions' },
  'Duplicate colors': { sectionId: 'render-mode', label: 'Switch render mode' },
};

export default function QualityWarningsList({
  warnings,
  qaFlags,
  onAdjustClick,
}: QualityWarningsListProps) {
  if (warnings.length === 0 && qaFlags.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]">
      <p className="font-semibold">Quality checks</p>

      {warnings.length > 0 && (
        <ul className="mt-2 space-y-2">
          {warnings.map((warning, index) => {
            const adjustment = ADJUSTMENT_MAP[warning];
            return (
              <li
                key={`${warning}-${index}`}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span>{warning}</span>
                {adjustment && (
                  <button
                    type="button"
                    onClick={() => onAdjustClick(adjustment.sectionId)}
                    className="text-[color:var(--brand-primary)] font-semibold hover:underline whitespace-nowrap flex-shrink-0"
                    aria-label={`Adjust: ${adjustment.label}`}
                  >
                    Adjust →
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {qaFlags.length > 0 && (
        <>
          {warnings.length > 0 && <div className="mt-3 border-t border-[color:var(--border-soft)]/50 pt-3" />}
          <p className="font-semibold">Flags to review:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {qaFlags.map((flag, index) => (
              <li key={`${flag}-${index}`}>{flag}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
