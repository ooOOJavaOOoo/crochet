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

type ProjectPreset = BlanketPreset;

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

const PROJECT_SIZE_PRESETS: Record<OutputType, ProjectPreset[]> = {
  blanket: BLANKET_PRESETS,
  beanie: [
    { label: 'Child (60 x 70)', width: 60, height: 70 },
    { label: 'Adult (70 x 80)', width: 70, height: 80 },
    { label: 'Slouchy (80 x 90)', width: 80, height: 90 },
    { label: 'Custom', width: 70, height: 80 },
  ],
  scarf: [
    { label: 'Short (60 x 180)', width: 60, height: 180 },
    { label: 'Classic (70 x 220)', width: 70, height: 220 },
    { label: 'Long (80 x 280)', width: 80, height: 280 },
    { label: 'Custom', width: 70, height: 220 },
  ],
  amigurumi: [
    { label: 'Small plush (70 x 90)', width: 70, height: 90 },
    { label: 'Medium plush (90 x 120)', width: 90, height: 120 },
    { label: 'Large plush (120 x 160)', width: 120, height: 160 },
    { label: 'Custom', width: 90, height: 120 },
  ],
  top: [
    { label: 'XS-S (140 x 170)', width: 140, height: 170 },
    { label: 'M-L (170 x 190)', width: 170, height: 190 },
    { label: 'XL-2XL (200 x 220)', width: 200, height: 220 },
    { label: 'Custom', width: 170, height: 190 },
  ],
  sweater: [
    { label: 'XS-S (180 x 210)', width: 180, height: 210 },
    { label: 'M-L (210 x 240)', width: 210, height: 240 },
    { label: 'XL-2XL (240 x 280)', width: 240, height: 280 },
    { label: 'Custom', width: 210, height: 240 },
  ],
  shawl: [
    { label: 'Petite (140 x 140)', width: 140, height: 140 },
    { label: 'Classic (180 x 180)', width: 180, height: 180 },
    { label: 'Wrap (220 x 200)', width: 220, height: 200 },
    { label: 'Custom', width: 180, height: 180 },
  ],
  hat: [
    { label: 'Child (60 x 70)', width: 60, height: 70 },
    { label: 'Adult (70 x 80)', width: 70, height: 80 },
    { label: 'Wide brim (90 x 90)', width: 90, height: 90 },
    { label: 'Custom', width: 70, height: 80 },
  ],
  bag: [
    { label: 'Mini (100 x 120)', width: 100, height: 120 },
    { label: 'Tote (140 x 160)', width: 140, height: 160 },
    { label: 'Large tote (170 x 200)', width: 170, height: 200 },
    { label: 'Custom', width: 140, height: 160 },
  ],
  pillow: [
    { label: 'Small (80 x 80)', width: 80, height: 80 },
    { label: 'Standard (100 x 100)', width: 100, height: 100 },
    { label: 'Large (120 x 120)', width: 120, height: 120 },
    { label: 'Custom', width: 100, height: 100 },
  ],
  'wall-hanging': [
    { label: 'Mini (80 x 110)', width: 80, height: 110 },
    { label: 'Standard (120 x 160)', width: 120, height: 160 },
    { label: 'Statement (160 x 220)', width: 160, height: 220 },
    { label: 'Custom', width: 120, height: 160 },
  ],
  other: [
    { label: 'Small (90 x 120)', width: 90, height: 120 },
    { label: 'Medium (120 x 160)', width: 120, height: 160 },
    { label: 'Large (160 x 220)', width: 160, height: 220 },
    { label: 'Custom', width: 120, height: 160 },
  ],
};

const YARN_BRANDS = [
  { value: 'red-heart', label: 'Red Heart' },
  { value: 'bernat', label: 'Bernat' },
  { value: 'lion-brand', label: 'Lion Brand' },
  { value: 'caron', label: 'Caron' },
  { value: 'i-love-this-yarn', label: 'I Love this Yarn' },
  { value: 'yarn-bee', label: 'Yarn Bee (DK)' },
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
  const activePresets = PROJECT_SIZE_PRESETS[outputType] ?? BLANKET_PRESETS;
  const customPresetIndex = activePresets.length - 1;
  const isCustomPreset = presetIndex === customPresetIndex;

  const handlePresetChange = (index: number) => {
    const preset = activePresets[index] ?? activePresets[activePresets.length - 1];
    onDispatch({
      type: 'SetPreset',
      presetIndex: index,
      width: preset.width,
      height: preset.height,
    });
  };

  const handleOutputTypeChange = (nextOutputType: OutputType) => {
    onDispatch({ type: 'SetOutputType', outputType: nextOutputType });
    const presets = PROJECT_SIZE_PRESETS[nextOutputType] ?? BLANKET_PRESETS;
    const defaultPresetIndex = Math.min(1, presets.length - 1);
    const defaultPreset = presets[defaultPresetIndex] ?? presets[0];
    onDispatch({
      type: 'SetPreset',
      presetIndex: defaultPresetIndex,
      width: defaultPreset.width,
      height: defaultPreset.height,
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
            onChange={(event) => handleOutputTypeChange(event.target.value as OutputType)}
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
            {activePresets.map((preset, index) => (
              <option key={preset.label} value={index}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {/* Yarn Brand */}
        <div>
          <label htmlFor="brand" className="form-label">
            Brand
          </label>
          <select
            id="brand"
            value={brandId}
            onChange={(event) => onDispatch({ type: 'SetBrandId', brandId: event.target.value })}
            className="form-input"
            required
          >
            <option value="" disabled>
              Select a yarn brand
            </option>
            {YARN_BRANDS.map((brand) => (
              <option key={brand.value} value={brand.value}>
                {brand.label}
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

      </div>

      {/* Advanced Settings (Collapsible) */}
      <AdvancedSettings
        renderMode={renderMode}
        flattenBackgroundRegions={flattenBackgroundRegions}
        colorCount={colorCount}
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
