'use client';

import type { OutputType, PatternData, RenderMode, StitchType, YarnWeight } from '@/lib/types';
import type { Action } from '@/app/page';
import AdvancedSettings from './AdvancedSettings';
import {
  YARN_WEIGHT_CONFIGS,
  getYarnWeightConfig,
  getDefaultHook,
  CROSS_STITCH_AIDA_OPTIONS,
} from '@/lib/yarnWeight';

interface BlanketPreset {
  label: string;
  width: number;
  height: number;
}

interface YarnColorOption {
  id: string;
  name: string;
  hex: string;
}

interface SettingsFormProps {
  presetIndex: number;
  gridWidth: number;
  gridHeight: number;
  outputType: OutputType;
  customOutputTypeLabel: string;
  colorCount: number;
  renderMode: RenderMode;
  flattenBackgroundRegions: boolean;
  stitchType: StitchType;
  yarnWeight: YarnWeight;
  hookSize: string;
  brandId: string;
  availableYarnColors: YarnColorOption[];
  selectedYarnColorIds: string[];
  imageInputMode: 'upload' | 'ai-generate' | 'ai-edit';
  patternData: PatternData | null;
  isAdvancedSettingsExpanded?: boolean;
  onAdvancedSettingsExpandedChange?: (expanded: boolean) => void;
  onDispatch: (action: Action) => void;
}

const BLANKET_PRESETS: BlanketPreset[] = [
  { label: 'Baby (80 x 100)', width: 80, height: 100 },
  { label: 'Throw (120 x 160)', width: 120, height: 160 },
  { label: 'Twin (180 x 220)', width: 180, height: 220 },
  { label: 'Custom', width: 120, height: 160 },
];

const OUTPUT_TYPE_OPTIONS: Array<{ value: OutputType; label: string }> = [
  { value: 'blanket', label: 'Blanket' },
  { value: 'beanie', label: 'Beanie' },
  { value: 'scarf', label: 'Scarf' },
  { value: 'amigurumi', label: 'Amigurumi' },
  { value: 'top', label: 'Top' },
  { value: 'sweater', label: 'Sweater' },
  { value: 'shawl', label: 'Shawl' },
  { value: 'hat', label: 'Hat' },
  { value: 'bag', label: 'Bag' },
  { value: 'pillow', label: 'Pillow' },
  { value: 'wall-hanging', label: 'Wall Hanging' },
  { value: 'other', label: 'Other (custom)' },
];

const HERO_SWATCHES = [
  { name: 'Terracotta Thread', hex: '#b85c38' },
  { name: 'Oat Gold', hex: '#d89e58' },
  { name: 'Moss Loop', hex: '#35624a' },
  { name: 'Denim Stitch', hex: '#2e5e8a' },
  { name: 'Walnut Warmth', hex: '#6f4f3a' },
];

export default function SettingsForm({
  presetIndex,
  gridWidth,
  gridHeight,
  outputType,
  customOutputTypeLabel,
  colorCount,
  renderMode,
  flattenBackgroundRegions,
  stitchType,
  yarnWeight,
  hookSize,
  brandId,
  availableYarnColors,
  selectedYarnColorIds,
  imageInputMode,
  patternData,
  isAdvancedSettingsExpanded,
  onAdvancedSettingsExpandedChange,
  onDispatch,
}: SettingsFormProps) {
  const isCustomPreset = presetIndex === BLANKET_PRESETS.length - 1;

  const handlePresetChange = (index: number) => {
    const preset = BLANKET_PRESETS[index] ?? BLANKET_PRESETS[BLANKET_PRESETS.length - 1];
    onDispatch({
      type: 'SetPreset',
      presetIndex: index,
      width: preset.width,
      height: preset.height,
    });
  };

  return (
    <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-secondary)]">Step 2</p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-[color:var(--foreground)]">Pattern settings</h2>
        </div>
        <div className="rounded-full bg-[color:var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-secondary)]">
          Fine tune the yarn math
        </div>
      </div>

      {/* Main Settings (Always Visible) */}
      <div className="space-y-5 mb-5">
        {/* Output Type */}
        <div>
          <label htmlFor="output-type" className="form-label">
            Output type
          </label>
          <select
            id="output-type"
            value={outputType}
            onChange={(event) =>
              onDispatch({ type: 'SetOutputType', outputType: event.target.value as OutputType })
            }
            className="form-input"
          >
            {OUTPUT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {outputType === 'other' && (
          <div>
            <label htmlFor="custom-output-type" className="form-label">
              Custom output type
            </label>
            <input
              id="custom-output-type"
              type="text"
              maxLength={40}
              value={customOutputTypeLabel}
              onChange={(event) =>
                onDispatch({
                  type: 'SetCustomOutputTypeLabel',
                  customOutputTypeLabel: event.target.value,
                })
              }
              placeholder="Example: Cardigan, Mittens, Wall Pocket"
              className="form-input"
            />
          </div>
        )}

        {/* Project Size Preset */}
        <div>
          <label htmlFor="preset" className="form-label">
            Project size (stitch grid)
          </label>
          <select
            id="preset"
            value={presetIndex}
            onChange={(event) => handlePresetChange(Number(event.target.value))}
            className="form-input"
          >
            {BLANKET_PRESETS.map((preset, index) => (
              <option key={preset.label} value={index}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {isCustomPreset && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="grid-width" className="form-label">
                Grid width
              </label>
              <input
                id="grid-width"
                type="number"
                min={20}
                max={432}
                value={gridWidth}
                onChange={(event) =>
                  onDispatch({ type: 'SetGridWidth', gridWidth: Number(event.target.value) || 20 })
                }
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="grid-height" className="form-label">
                Grid height
              </label>
              <input
                id="grid-height"
                type="number"
                min={20}
                max={432}
                value={gridHeight}
                onChange={(event) =>
                  onDispatch({ type: 'SetGridHeight', gridHeight: Number(event.target.value) || 20 })
                }
                className="form-input"
              />
            </div>
          </div>
        )}

        {/* Color Count Slider */}
        <div className="rounded-[1.5rem] bg-gradient-to-r from-[rgba(184,92,56,0.08)] via-[rgba(216,158,88,0.12)] to-[rgba(46,94,138,0.08)] px-4 py-4">
          <label htmlFor="color-count" className="form-label mb-2">
            Number of colors: <span className="text-[color:var(--foreground)]">{colorCount}</span>
          </label>
          <input
            id="color-count-slider"
            type="range"
            min={2}
            max={25}
            value={colorCount}
            onChange={(event) =>
              onDispatch({ type: 'SetColorCount', colorCount: Number(event.target.value) })
            }
            className="color-slider w-full"
            aria-valuenow={colorCount}
            aria-valuemin={2}
            aria-valuemax={25}
            aria-label="Number of colors"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {HERO_SWATCHES.slice(0, Math.min(colorCount, HERO_SWATCHES.length)).map((swatch) => (
              <span
                key={swatch.name}
                className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)]"
              >
                {swatch.name}
              </span>
            ))}
          </div>
          {colorCount <= 4 && (
            <p className="mt-3 rounded-2xl border border-[color:var(--border-strong)] bg-white/70 px-3 py-3 text-xs leading-5 text-[color:var(--foreground)]">
              Very low color counts can flatten details. Increase the slider if the preview feels too simplified.
            </p>
          )}
        </div>
      </div>

      {/* Advanced Settings (Collapsible) */}
      <AdvancedSettings
        renderMode={renderMode}
        flattenBackgroundRegions={flattenBackgroundRegions}
        stitchType={stitchType}
        yarnWeight={yarnWeight}
        hookSize={hookSize}
        brandId={brandId}
        availableYarnColors={availableYarnColors}
        selectedYarnColorIds={selectedYarnColorIds}
        imageInputMode={imageInputMode}
        isExpanded={isAdvancedSettingsExpanded}
        onExpandedChange={onAdvancedSettingsExpandedChange}
        onDispatch={onDispatch}
      />
    </div>
  );
}
