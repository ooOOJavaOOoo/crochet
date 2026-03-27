'use client';

import { ChangeEvent, FormEvent, useEffect, useReducer } from 'react';
import type { PatternData, StitchType, YarnWeight } from '@/lib/types';
import { YARN_WEIGHT_CONFIGS, DEFAULT_YARN_WEIGHT, getYarnWeightConfig, getDefaultHook } from '@/lib/yarnWeight';

type Step = 'image' | 'settings' | 'generating' | 'preview' | 'buying';

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

const BLANKET_PRESETS: BlanketPreset[] = [
  { label: 'Baby (80 x 100)', width: 80, height: 100 },
  { label: 'Throw (120 x 160)', width: 120, height: 160 },
  { label: 'Twin (180 x 220)', width: 180, height: 220 },
  { label: 'Custom', width: 120, height: 160 },
];

const YARN_BRANDS = [
  { value: 'red-heart', label: 'Red Heart' },
  { value: 'bernat', label: 'Bernat' },
  { value: 'lion-brand', label: 'Lion Brand' },
  { value: 'caron', label: 'Caron' },
];

interface State {
  step: Step;
  imageBase64: string | null;
  presetIndex: number;
  gridWidth: number;
  gridHeight: number;
  colorCount: number;
  stitchType: StitchType;
  yarnWeight: YarnWeight;
  hookSize: string;
  brandId: string;
  availableYarnColors: YarnColorOption[];
  selectedYarnColorIds: string[];
  patternData: PatternData | null;
  previewData: PreviewData | null;
  loadingMessage: string | null;
  error: string | null;
  toast: string | null;
}

type Action =
  | { type: 'SetStep'; step: Step }
  | { type: 'SetImageBase64'; imageBase64: string | null }
  | { type: 'SetPreset'; presetIndex: number; width: number; height: number }
  | { type: 'SetGridWidth'; gridWidth: number }
  | { type: 'SetGridHeight'; gridHeight: number }
  | { type: 'SetColorCount'; colorCount: number }
  | { type: 'SetStitchType'; stitchType: StitchType }
  | { type: 'SetYarnWeight'; yarnWeight: YarnWeight }
  | { type: 'SetHookSize'; hookSize: string }
  | { type: 'SetBrandId'; brandId: string }
  | { type: 'SetAvailableYarnColors'; colors: YarnColorOption[] }
  | { type: 'SetSelectedYarnColorIds'; colorIds: string[] }
  | { type: 'SetPatternData'; patternData: PatternData | null }
  | { type: 'SetPreviewData'; previewData: PreviewData | null }
  | { type: 'SetLoadingMessage'; loadingMessage: string | null }
  | { type: 'SetError'; error: string | null }
  | { type: 'SetToast'; toast: string | null }
  | { type: 'Reset' };

const initialPreset = BLANKET_PRESETS[1];

const INITIAL_STATE: State = {
  step: 'image',
  imageBase64: null,
  presetIndex: 1,
  gridWidth: initialPreset.width,
  gridHeight: initialPreset.height,
  colorCount: 6,
  stitchType: 'tapestry',
  yarnWeight: DEFAULT_YARN_WEIGHT,
  hookSize: getDefaultHook(DEFAULT_YARN_WEIGHT, 'tapestry'),
  brandId: 'red-heart',
  availableYarnColors: [],
  selectedYarnColorIds: [],
  patternData: null,
  previewData: null,
  loadingMessage: null,
  error: null,
  toast: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SetStep':
      return { ...state, step: action.step };
    case 'SetImageBase64':
      return { ...state, imageBase64: action.imageBase64, previewData: null, patternData: null };
    case 'SetPreset':
      return {
        ...state,
        presetIndex: action.presetIndex,
        gridWidth: action.width,
        gridHeight: action.height,
      };
    case 'SetGridWidth':
      return { ...state, gridWidth: action.gridWidth };
    case 'SetGridHeight':
      return { ...state, gridHeight: action.gridHeight };
    case 'SetColorCount':
      return { ...state, colorCount: action.colorCount };
    case 'SetStitchType':
      return {
        ...state,
        stitchType: action.stitchType,
        hookSize: getDefaultHook(state.yarnWeight, action.stitchType),
      };
    case 'SetYarnWeight':
      return {
        ...state,
        yarnWeight: action.yarnWeight,
        hookSize: getDefaultHook(action.yarnWeight, state.stitchType),
      };
    case 'SetHookSize':
      return { ...state, hookSize: action.hookSize };
    case 'SetBrandId':
      return {
        ...state,
        brandId: action.brandId,
        availableYarnColors: [],
        selectedYarnColorIds: [],
      };
    case 'SetAvailableYarnColors':
      return { ...state, availableYarnColors: action.colors };
    case 'SetSelectedYarnColorIds':
      return { ...state, selectedYarnColorIds: action.colorIds };
    case 'SetPatternData':
      return { ...state, patternData: action.patternData };
    case 'SetPreviewData':
      return { ...state, previewData: action.previewData };
    case 'SetLoadingMessage':
      return { ...state, loadingMessage: action.loadingMessage };
    case 'SetError':
      return { ...state, error: action.error };
    case 'SetToast':
      return { ...state, toast: action.toast };
    case 'Reset':
      return INITIAL_STATE;
    default:
      return state;
  }
}

async function getJsonOrThrow<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Invalid response from server.');
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : 'Request failed.';
    throw new Error(message);
  }

  return payload as T;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file as data URL.'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read selected file.'));
    reader.readAsDataURL(file);
  });
}

export default function HomePage() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const activeQualityWarnings = state.patternData?.qualityWarnings ?? [];

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

  useEffect(() => {
    if (!state.toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'SetToast', toast: null });
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [state.toast]);

  useEffect(() => {
    if (!state.brandId) {
      dispatch({ type: 'SetAvailableYarnColors', colors: [] });
      return;
    }

    const controller = new AbortController();

    const loadColors = async () => {
      try {
        const res = await fetch(`/api/yarn/colors?brandId=${encodeURIComponent(state.brandId)}`, {
          signal: controller.signal,
        });
        const data = await getJsonOrThrow<{ colors: YarnColorOption[] }>(res);
        dispatch({ type: 'SetAvailableYarnColors', colors: data.colors });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        dispatch({ type: 'SetAvailableYarnColors', colors: [] });
        const message = error instanceof Error ? error.message : 'Failed to load yarn colors.';
        dispatch({ type: 'SetError', error: message });
      }
    };

    void loadColors();

    return () => controller.abort();
  }, [state.brandId]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      dispatch({ type: 'SetError', error: 'Please choose an image smaller than 10MB.' });
      return;
    }

    try {
      dispatch({ type: 'SetError', error: null });
      const base64 = await fileToBase64(file);
      dispatch({ type: 'SetImageBase64', imageBase64: base64 });
      dispatch({ type: 'SetStep', step: 'settings' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read selected image.';
      dispatch({ type: 'SetError', error: message });
    }
  };

  const handlePresetChange = (presetIndex: number) => {
    const preset = BLANKET_PRESETS[presetIndex] ?? BLANKET_PRESETS[BLANKET_PRESETS.length - 1];
    dispatch({
      type: 'SetPreset',
      presetIndex,
      width: preset.width,
      height: preset.height,
    });
  };

  const handleGeneratePreview = async () => {
    if (!state.imageBase64) {
      dispatch({ type: 'SetError', error: 'Please upload an image first.' });
      return;
    }

    if (state.gridWidth < 20 || state.gridHeight < 20) {
      dispatch({ type: 'SetError', error: 'Grid dimensions must be at least 20 x 20.' });
      return;
    }

    try {
      dispatch({ type: 'SetError', error: null });
      dispatch({ type: 'SetStep', step: 'generating' });
      dispatch({ type: 'SetLoadingMessage', loadingMessage: 'Analyzing image...' });

      const patternRes = await fetch('/api/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: state.imageBase64,
          gridWidth: state.gridWidth,
          gridHeight: state.gridHeight,
          colorCount: state.colorCount,
          stitchType: state.stitchType,
          yarnWeight: state.yarnWeight,
          hookSize: state.hookSize,
          brandId: state.brandId || undefined,
          selectedYarnColorIds:
            state.selectedYarnColorIds.length > 0 ? state.selectedYarnColorIds : undefined,
        }),
      });

      const patternData = await getJsonOrThrow<PatternData>(patternRes);
      dispatch({ type: 'SetPatternData', patternData });

      dispatch({ type: 'SetLoadingMessage', loadingMessage: 'Rendering preview...' });
      const previewRes = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternId: patternData.patternId }),
      });

      const previewData = await getJsonOrThrow<PreviewData>(previewRes);
      dispatch({ type: 'SetPreviewData', previewData });
      dispatch({ type: 'SetStep', step: 'preview' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Preview generation failed.';
      dispatch({ type: 'SetError', error: message });
      dispatch({ type: 'SetStep', step: state.imageBase64 ? 'settings' : 'image' });
    } finally {
      dispatch({ type: 'SetLoadingMessage', loadingMessage: null });
    }
  };

  const handleCheckout = async () => {
    if (!state.previewData?.patternId) {
      dispatch({ type: 'SetError', error: 'Preview is required before checkout.' });
      return;
    }

    try {
      dispatch({ type: 'SetError', error: null });
      dispatch({ type: 'SetStep', step: 'buying' });
      dispatch({ type: 'SetLoadingMessage', loadingMessage: 'Creating secure checkout...' });

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternId: state.previewData.patternId }),
      });

      const data = await getJsonOrThrow<{ checkoutUrl: string }>(res);
      window.location.href = data.checkoutUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Checkout failed.';
      dispatch({ type: 'SetError', error: message });
      dispatch({ type: 'SetStep', step: 'preview' });
      dispatch({ type: 'SetLoadingMessage', loadingMessage: null });
    }
  };

  const isCustomPreset = state.presetIndex === BLANKET_PRESETS.length - 1;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Crochet Pattern Generator</h1>
            <p className="mt-1 text-sm text-slate-600">
              Upload or generate an image, tune your settings, then preview and purchase the full PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'Reset' })}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Start Over
          </button>
        </div>

        {state.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
        )}

        {state.toast && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {state.toast}
          </div>
        )}

        {state.loadingMessage && (
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            {state.loadingMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">1. Choose Your Image</h2>

              <div className="space-y-3">
                <label htmlFor="photo" className="block text-sm font-medium text-slate-700">
                  Upload photo (JPEG, PNG, WebP up to 10MB)
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
                />
                <p className="text-xs text-slate-500">
                  Upload an image to generate your crochet pattern preview.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">2. Pattern Settings</h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="preset" className="mb-1 block text-sm font-medium text-slate-700">
                    Blanket size
                  </label>
                  <select
                    id="preset"
                    value={state.presetIndex}
                    onChange={(event) => handlePresetChange(Number(event.target.value))}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
                      <label htmlFor="grid-width" className="mb-1 block text-sm font-medium text-slate-700">
                        Grid width
                      </label>
                      <input
                        id="grid-width"
                        type="number"
                        min={20}
                        max={432}
                        value={state.gridWidth}
                        onChange={(event) =>
                          dispatch({ type: 'SetGridWidth', gridWidth: Number(event.target.value) || 20 })
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="grid-height" className="mb-1 block text-sm font-medium text-slate-700">
                        Grid height
                      </label>
                      <input
                        id="grid-height"
                        type="number"
                        min={20}
                        max={432}
                        value={state.gridHeight}
                        onChange={(event) =>
                          dispatch({ type: 'SetGridHeight', gridHeight: Number(event.target.value) || 20 })
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 block text-sm font-medium text-slate-700">Color count</p>
                  <div className="mt-3">
                    <label htmlFor="color-count" className="mb-1 block text-sm text-slate-600">
                      Number of colors: <span className="font-medium text-slate-800">{state.colorCount}</span>
                    </label>
                    <input
                      id="color-count"
                      type="range"
                      min={2}
                      max={25}
                      value={state.colorCount}
                      onChange={(event) =>
                        dispatch({ type: 'SetColorCount', colorCount: Number(event.target.value) })
                      }
                      className="w-full"
                    />
                    {state.colorCount <= 4 && (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Very low color counts can reduce image clarity. Increase the color count if details look too simplified.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-1 block text-sm font-medium text-slate-700">Stitch type</p>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SetStitchType', stitchType: 'tapestry' })}
                      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                        state.stitchType === 'tapestry' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tapestry
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SetStitchType', stitchType: 'c2c' })}
                      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                        state.stitchType === 'c2c' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      C2C (Corner-to-Corner)
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {state.stitchType === 'tapestry'
                      ? getYarnWeightConfig(state.yarnWeight).tapestryGaugeHint
                      : getYarnWeightConfig(state.yarnWeight).c2cGaugeHint}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="yarn-weight" className="mb-1 block text-sm font-medium text-slate-700">
                      Yarn weight
                    </label>
                    <select
                      id="yarn-weight"
                      value={state.yarnWeight}
                      onChange={(event) =>
                        dispatch({ type: 'SetYarnWeight', yarnWeight: event.target.value as YarnWeight })
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {YARN_WEIGHT_CONFIGS.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="hook-size" className="mb-1 block text-sm font-medium text-slate-700">
                      Hook size
                    </label>
                    <select
                      id="hook-size"
                      value={state.hookSize}
                      onChange={(event) =>
                        dispatch({ type: 'SetHookSize', hookSize: event.target.value })
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {getYarnWeightConfig(state.yarnWeight).hookOptions.map((h) => (
                        <option key={h.label} value={h.label}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="brand" className="mb-1 block text-sm font-medium text-slate-700">
                    Yarn brand (optional)
                  </label>
                  <select
                    id="brand"
                    value={state.brandId}
                    onChange={(event) => dispatch({ type: 'SetBrandId', brandId: event.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {YARN_BRANDS.map((brand) => (
                      <option key={brand.value || 'none'} value={brand.value}>
                        {brand.label}
                      </option>
                    ))}
                  </select>
                </div>

                {state.brandId && (
                  <div>
                    <label htmlFor="brand-colors" className="mb-1 block text-sm font-medium text-slate-700">
                      On-hand yarn colors (optional)
                    </label>
                    <select
                      id="brand-colors"
                      multiple
                      value={state.selectedYarnColorIds}
                      onChange={(event) => {
                        const selected = Array.from(event.target.selectedOptions, (option) => option.value);
                        dispatch({ type: 'SetSelectedYarnColorIds', colorIds: selected });
                      }}
                      className="h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {state.availableYarnColors.map((color) => (
                        <option key={color.id} value={color.id}>
                          {`${color.name} (${color.hex})`}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      Choose one or more colors to limit the pattern to what you already have.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGeneratePreview}
              disabled={!state.imageBase64 || state.loadingMessage !== null}
              className="w-full rounded-xl bg-violet-700 px-6 py-4 text-base font-semibold text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Generate Preview
            </button>
          </section>

          <section className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Preview Area</h2>

              {activeQualityWarnings.length > 0 && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {activeQualityWarnings[0]}
                </div>
              )}

              {state.imageBase64 ? (
                <div className="relative h-64 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <img
                    src={state.imageBase64}
                    alt="Source preview"
                    className="h-full w-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(15,23,42,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.22) 1px, transparent 1px)',
                      backgroundSize: '12px 12px',
                      backgroundPosition: '0 0, 0 0',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                  Your uploaded image preview appears here.
                </div>
              )}
            </div>

            {state.previewData && (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-base font-semibold">{state.previewData.title}</h3>
                  <div className="relative h-[460px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div
                      className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: state.previewData.previewSvg }}
                    />
                    {state.previewData.isWatermarked && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="rotate-[-18deg] text-3xl font-black uppercase tracking-[0.18em] text-slate-900/18 sm:text-5xl">
                          Preview Only
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-base font-semibold">Color Legend</h3>
                  <p className="mb-4 text-sm text-slate-600">
                    Preview includes {state.previewData.colorLegend.length} of {state.previewData.totalLegendCount} colors.
                    {state.previewData.hiddenLegendCount > 0
                      ? ` Purchase the PDF to unlock the remaining ${state.previewData.hiddenLegendCount} colors and full yarn inventory.`
                      : ' Purchase the PDF to unlock the complete pattern and yarn inventory.'}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          <th className="px-3 py-2">Color</th>
                          <th className="px-3 py-2">Symbol</th>
                          <th className="px-3 py-2">Yarn Color</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.previewData.colorLegend.map((entry, index) => (
                          <tr key={`${entry.symbol}-${entry.hex}-${index}`} className="border-t border-slate-100">
                            <td className="px-3 py-2">
                              <span
                                className="inline-block h-5 w-5 rounded border border-slate-300"
                                style={{ backgroundColor: entry.hex }}
                                aria-label={`Color ${entry.hex}`}
                              />
                            </td>
                            <td className="px-3 py-2 font-semibold">{entry.symbol}</td>
                            <td className="px-3 py-2">{getYarnDisplayName(entry)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={state.loadingMessage !== null || state.step === 'buying'}
                  className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Buy PDF Pattern
                </button>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
