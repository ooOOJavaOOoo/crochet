'use client';

import type { RenderMode, StitchType, YarnWeight, OutputType } from '@/lib/types';
import type { Action } from '@/app/page';
import {
  YARN_WEIGHT_CONFIGS,
  getYarnWeightConfig,
  CROSS_STITCH_AIDA_OPTIONS,
} from '@/lib/yarnWeight';

interface YarnColorOption {
  id: string;
  name: string;
  hex: string;
}

interface AdvancedSettingsProps {
  renderMode: RenderMode;
  flattenBackgroundRegions: boolean;
  stitchType: StitchType;
  yarnWeight: YarnWeight;
  hookSize: string;
  brandId: string;
  availableYarnColors: YarnColorOption[];
  selectedYarnColorIds: string[];
  imageInputMode: 'upload' | 'ai-generate' | 'ai-edit';
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onDispatch: (action: Action) => void;
}

const YARN_BRANDS = [
  { value: 'red-heart', label: 'Red Heart' },
  { value: 'bernat', label: 'Bernat' },
  { value: 'lion-brand', label: 'Lion Brand' },
  { value: 'caron', label: 'Caron' },
  { value: 'i-love-this-yarn', label: 'I Love this Yarn' },
  { value: 'yarn-bee', label: 'Yarn Bee (DK)' },
];

export default function AdvancedSettings({
  renderMode,
  flattenBackgroundRegions,
  stitchType,
  yarnWeight,
  hookSize,
  brandId,
  availableYarnColors,
  selectedYarnColorIds,
  imageInputMode,
  isExpanded,
  onExpandedChange,
  onDispatch,
}: AdvancedSettingsProps) {
  return (
    <details
      open={isExpanded}
      onToggle={(e) => onExpandedChange?.(e.currentTarget.open)}
      className="rounded-[1.2rem] border border-[color:var(--border-soft)] bg-white/60 p-4"
    >
      <summary className="cursor-pointer font-semibold text-[color:var(--foreground)] rounded-xl bg-gradient-to-r from-[rgba(184,92,56,0.08)] to-[rgba(59,102,80,0.08)] px-4 py-3 hover:bg-opacity-80 transition-colors list-none mb-4">
        <span className="inline-block mr-2 transition-transform" aria-hidden="true">
          ▶
        </span>
        ⚙️ Advanced Settings
        <span className="text-xs text-[color:var(--text-secondary)] ml-2">
          (Render, craft, yarn weight, brand colors)
        </span>
      </summary>

      <div className="space-y-5 rounded-xl bg-white/50 p-4">
        {/* Render Mode */}
        <div>
          <p className="form-label mb-3">Render style</p>
          <div className="segmented-control">
            <button
              type="button"
              onClick={() => onDispatch({ type: 'SetRenderMode', renderMode: 'graphic-clean-art' })}
              className={`segmented-button ${renderMode === 'graphic-clean-art' ? 'segmented-button-active' : ''}`}
            >
              Graphic/Clean Art
            </button>
            <button
              type="button"
              onClick={() => onDispatch({ type: 'SetRenderMode', renderMode: 'photo-gradient' })}
              className={`segmented-button ${renderMode === 'photo-gradient' ? 'segmented-button-active' : ''}`}
            >
              Photo/Gradient
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
            Use Graphic/Clean Art for sharper edges and flatter zones. Use Photo/Gradient to preserve tonal transitions.
          </p>

          <label className="mt-3 flex items-start gap-2 rounded-xl bg-[color:var(--surface-subtle)]/70 px-3 py-3 text-sm text-[color:var(--foreground)]">
            <input
              type="checkbox"
              checked={flattenBackgroundRegions}
              onChange={(event) =>
                onDispatch({
                  type: 'SetFlattenBackgroundRegions',
                  flattenBackgroundRegions: event.target.checked,
                })
              }
              className="mt-0.5"
            />
            <span>
              Flatten background regions (sky/ground/tree masses) for simpler beginner-friendly charts.
            </span>
          </label>
        </div>

        {/* Craft Type */}
        <div>
          <p className="form-label mb-3">Craft type</p>
          <div className="segmented-control">
            <button
              type="button"
              onClick={() => onDispatch({ type: 'SetStitchType', stitchType: 'tapestry' })}
              className={`segmented-button ${stitchType === 'tapestry' ? 'segmented-button-active' : ''}`}
            >
              Crochet
            </button>
            <button
              type="button"
              onClick={() => onDispatch({ type: 'SetStitchType', stitchType: 'c2c' })}
              className={`segmented-button ${stitchType === 'c2c' ? 'segmented-button-active' : ''}`}
            >
              C2C
            </button>
            <button
              type="button"
              onClick={() => onDispatch({ type: 'SetStitchType', stitchType: 'knitting' })}
              className={`segmented-button ${stitchType === 'knitting' ? 'segmented-button-active' : ''}`}
            >
              Knitting
            </button>
            <button
              type="button"
              onClick={() => onDispatch({ type: 'SetStitchType', stitchType: 'cross-stitch' })}
              className={`segmented-button ${stitchType === 'cross-stitch' ? 'segmented-button-active' : ''}`}
            >
              Cross-Stitch
            </button>
          </div>
        </div>

        {/* Yarn Weight & Hook Size (upload mode only) */}
        {imageInputMode === 'upload' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="yarn-weight-adv" className="form-label">
                Yarn weight
              </label>
              <select
                id="yarn-weight-adv"
                value={yarnWeight}
                onChange={(event) =>
                  onDispatch({ type: 'SetYarnWeight', yarnWeight: event.target.value as YarnWeight })
                }
                className="form-input"
              >
                {YARN_WEIGHT_CONFIGS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="hook-size-adv" className="form-label">
                {stitchType === 'knitting' ? 'Needle size' : stitchType === 'cross-stitch' ? 'Fabric count' : 'Hook size'}
              </label>
              <select
                id="hook-size-adv"
                value={hookSize}
                onChange={(event) =>
                  onDispatch({ type: 'SetHookSize', hookSize: event.target.value })
                }
                className="form-input"
              >
                {(stitchType === 'knitting'
                  ? getYarnWeightConfig(yarnWeight).needleOptions
                  : stitchType === 'cross-stitch'
                  ? CROSS_STITCH_AIDA_OPTIONS
                  : getYarnWeightConfig(yarnWeight).hookOptions
                ).map((h) => (
                  <option key={h.label} value={h.label}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-subtle)]/60 px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]">
            AI mode will auto-detect yarn weight and hook size for this pattern. You can still control stitch type, project size, and yarn brand.
          </div>
        )}

        {/* Yarn Brand */}
        <div>
          <label htmlFor="brand-adv" className="form-label">
            Yarn brand
          </label>
          <select
            id="brand-adv"
            value={brandId}
            onChange={(event) => onDispatch({ type: 'SetBrandId', brandId: event.target.value })}
            className="form-input"
            required
          >
            {YARN_BRANDS.map((brand) => (
              <option key={brand.value} value={brand.value}>
                {brand.label}
              </option>
            ))}
          </select>
        </div>

        {/* Yarn Colors */}
        {brandId && (
          <div>
            <label htmlFor="brand-colors-adv" className="form-label">
              On-hand yarn colors (optional)
            </label>
            <select
              id="brand-colors-adv"
              multiple
              value={selectedYarnColorIds}
              onChange={(event) => {
                const selected = Array.from(event.target.selectedOptions, (option) => option.value);
                onDispatch({ type: 'SetSelectedYarnColorIds', colorIds: selected });
              }}
              className="form-input h-36"
            >
              {availableYarnColors.map((color) => (
                <option key={color.id} value={color.id}>
                  {`${color.name} (${color.hex})`}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              Limit the palette to yarn you already own and keep your final shopping list realistic.
            </p>
          </div>
        )}
      </div>
    </details>
  );
}
