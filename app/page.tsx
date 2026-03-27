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

const HERO_SWATCHES = [
  { name: 'Berry Pop', hex: '#dc5a87' },
  { name: 'Sunny Gold', hex: '#f4b544' },
  { name: 'Mint Loop', hex: '#7bc8a4' },
  { name: 'Sky Stitch', hex: '#73c7d9' },
  { name: 'Coral Twist', hex: '#f26f63' },
];

const CROCHET_FEATURES = [
  'Match your yarn palette before generating the chart.',
  'Preview the stitch map with a colorful legend and watermark-safe sample.',
  'Check out with one click when the pattern looks right.',
];

const STUDIO_THEME_IMAGES = [
  {
    label: 'Granny square texture',
    src: '/studio-granny-square.svg',
    palette: ['#e76f51', '#f4a261', '#f1c372', '#7bc8a4'],
  },
  {
    label: 'Colorful yarn wall',
    src: '/studio-yarn-wall.svg',
    palette: ['#dc5a87', '#f4b544', '#73c7d9', '#9b7bd3'],
  },
  {
    label: 'Crochet blanket close-up',
    src: '/studio-blanket-detail.svg',
    palette: ['#c86f58', '#f2ba7c', '#6fa8a3', '#445a7b'],
  },
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
  const currentPresetLabel = BLANKET_PRESETS[state.presetIndex]?.label ?? 'Custom';

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
    <div className="crochet-page min-h-screen text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="crochet-hero mb-8 rounded-[2rem] px-6 py-7 sm:px-8 lg:px-10 lg:py-10">
          <div aria-hidden="true" className="skein skein-peach float-gentle right-6 top-6 hidden lg:block" />
          <div aria-hidden="true" className="skein skein-gold float-gentle-slow bottom-8 left-[48%] hidden lg:block" />
          <div aria-hidden="true" className="skein skein-mint float-gentle left-8 top-20 hidden xl:block" />
          <div aria-hidden="true" className="hook float-gentle-slow right-28 top-24 hidden lg:block rotate-[28deg]" />
          <div aria-hidden="true" className="hook float-gentle bottom-16 left-8 hidden xl:block -rotate-[24deg]" />

          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="relative z-10">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="hero-badge text-xs font-semibold uppercase tracking-[0.22em]">Crochet Studio</span>
                <span className="rounded-full border border-white/60 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">
                  Yarn-first UI refresh
                </span>
              </div>

              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                    Turn photos into bright, yarn-ready crochet patterns.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
                    Upload a favorite image, tune the palette and stitch settings, then preview the chart in a page that feels handmade instead of clinical.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => dispatch({ type: 'Reset' })}
                  className="secondary-button shrink-0 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Start Over
                </button>
              </div>

              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                {CROCHET_FEATURES.map((feature) => (
                  <div key={feature} className="feature-pill rounded-2xl px-4 py-4 text-sm leading-6 text-slate-700">
                    {feature}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <span className="rounded-full bg-white/70 px-4 py-2 font-semibold">Preset: {currentPresetLabel}</span>
                <span className="rounded-full bg-white/70 px-4 py-2 font-semibold">Colors: {state.colorCount}</span>
                <span className="rounded-full bg-white/70 px-4 py-2 font-semibold">Hook: {state.hookSize}</span>
                <span className="rounded-full bg-white/70 px-4 py-2 font-semibold">Brand: {YARN_BRANDS.find((brand) => brand.value === state.brandId)?.label ?? 'Any'}</span>
              </div>
            </div>

            <aside className="crochet-card-soft shine-surface relative z-10 rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">Studio palette</p>
                  <h2 className="font-display mt-1 text-2xl font-semibold text-slate-900">Colorful by default</h2>
                </div>
                <div className="flex -space-x-2">
                  {HERO_SWATCHES.map((swatch) => (
                    <span
                      key={swatch.name}
                      className="swatch-dot"
                      style={{ backgroundColor: swatch.hex }}
                      aria-label={swatch.name}
                      title={swatch.name}
                    />
                  ))}
                </div>
              </div>

              <div className="studio-image-grid mb-5 grid gap-3 sm:grid-cols-2">
                {STUDIO_THEME_IMAGES.map((item, index) => (
                  <article
                    key={item.label}
                    className={`studio-image-card ${index === 0 ? 'sm:col-span-2' : ''}`}
                    style={{ backgroundImage: `url(${item.src})` }}
                  >
                    <div className="studio-image-overlay" />
                    <div className="studio-image-content">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">Studio inspiration</p>
                      <p className="mt-1 text-sm font-semibold text-white">{item.label}</p>
                      <div className="mt-3 flex items-center gap-2">
                        {item.palette.map((tone) => (
                          <span
                            key={tone}
                            className="h-3 w-6 rounded-full border border-white/70"
                            style={{ backgroundColor: tone }}
                            aria-label={`Palette color ${tone}`}
                          />
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="rounded-[1.5rem] border border-white/60 bg-white/75 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-700">Project recipe</p>
                    <p className="mt-1 text-sm text-slate-600">Balanced for quick previews and colorful finished PDFs.</p>
                  </div>
                  <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-800">
                    Ready to stitch
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-3">
                    <span>Stitch mode</span>
                    <span className="font-semibold text-slate-900">{state.stitchType === 'tapestry' ? 'Tapestry' : 'C2C'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-3">
                    <span>Yarn weight</span>
                    <span className="font-semibold text-slate-900">{getYarnWeightConfig(state.yarnWeight).label}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
                    <span>Grid size</span>
                    <span className="font-semibold text-slate-900">{state.gridWidth} x {state.gridHeight}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <div className="mb-6 space-y-3">
          {state.error && <div className="banner banner-error">{state.error}</div>}

          {state.toast && <div className="banner banner-success">{state.toast}</div>}

          {state.loadingMessage && <div className="banner banner-info">{state.loadingMessage}</div>}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          <section className="space-y-6">
            <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">Step 1</p>
                  <h2 className="font-display mt-1 text-2xl font-semibold text-slate-900">Choose your image</h2>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <span className="swatch-dot !h-3 !w-3" style={{ backgroundColor: '#f26f63' }} />
                  Photo to pattern
                </div>
              </div>

              <div className="space-y-3">
                <label htmlFor="photo" className="form-label">
                  Upload photo (JPEG, PNG, WebP up to 10MB)
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="form-input block"
                />
                <p className="text-sm leading-6 text-slate-600">
                  Portraits, pets, florals, and graphic art all work. Start with a clean subject and strong contrast for the best chart.
                </p>
              </div>
            </div>

            <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Step 2</p>
                  <h2 className="font-display mt-1 text-2xl font-semibold text-slate-900">Pattern settings</h2>
                </div>
                <div className="rounded-full bg-violet-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                  Fine tune the yarn math
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label htmlFor="preset" className="form-label">
                    Blanket size
                  </label>
                  <select
                    id="preset"
                    value={state.presetIndex}
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
                        value={state.gridWidth}
                        onChange={(event) =>
                          dispatch({ type: 'SetGridWidth', gridWidth: Number(event.target.value) || 20 })
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
                        value={state.gridHeight}
                        onChange={(event) =>
                          dispatch({ type: 'SetGridHeight', gridHeight: Number(event.target.value) || 20 })
                        }
                        className="form-input"
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-[1.5rem] bg-gradient-to-r from-rose-50 via-amber-50 to-sky-50 px-4 py-4">
                  <label htmlFor="color-count" className="form-label mb-2">
                    Number of colors: <span className="text-slate-900">{state.colorCount}</span>
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
                    className="color-slider w-full"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {HERO_SWATCHES.slice(0, Math.min(state.colorCount, HERO_SWATCHES.length)).map((swatch) => (
                      <span
                        key={swatch.name}
                        className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        {swatch.name}
                      </span>
                    ))}
                  </div>
                  {state.colorCount <= 4 && (
                    <p className="mt-3 rounded-2xl border border-amber-200 bg-white/70 px-3 py-3 text-xs leading-5 text-amber-900">
                      Very low color counts can flatten details. Increase the slider if the preview feels too simplified.
                    </p>
                  )}
                </div>

                <div>
                  <p className="form-label">Stitch type</p>
                  <div className="segmented-control">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SetStitchType', stitchType: 'tapestry' })}
                      className={`segmented-button ${state.stitchType === 'tapestry' ? 'segmented-button-active' : ''}`}
                    >
                      Tapestry
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SetStitchType', stitchType: 'c2c' })}
                      className={`segmented-button ${state.stitchType === 'c2c' ? 'segmented-button-active' : ''}`}
                    >
                      C2C (Corner-to-Corner)
                    </button>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {state.stitchType === 'tapestry'
                      ? getYarnWeightConfig(state.yarnWeight).tapestryGaugeHint
                      : getYarnWeightConfig(state.yarnWeight).c2cGaugeHint}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="yarn-weight" className="form-label">
                      Yarn weight
                    </label>
                    <select
                      id="yarn-weight"
                      value={state.yarnWeight}
                      onChange={(event) =>
                        dispatch({ type: 'SetYarnWeight', yarnWeight: event.target.value as YarnWeight })
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
                    <label htmlFor="hook-size" className="form-label">
                      Hook size
                    </label>
                    <select
                      id="hook-size"
                      value={state.hookSize}
                      onChange={(event) => dispatch({ type: 'SetHookSize', hookSize: event.target.value })}
                      className="form-input"
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
                  <label htmlFor="brand" className="form-label">
                    Yarn brand (optional)
                  </label>
                  <select
                    id="brand"
                    value={state.brandId}
                    onChange={(event) => dispatch({ type: 'SetBrandId', brandId: event.target.value })}
                    className="form-input"
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
                    <label htmlFor="brand-colors" className="form-label">
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
                      className="form-input h-36"
                    >
                      {state.availableYarnColors.map((color) => (
                        <option key={color.id} value={color.id}>
                          {`${color.name} (${color.hex})`}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Limit the palette to yarn you already own and keep your final shopping list realistic.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGeneratePreview}
              disabled={!state.imageBase64 || state.loadingMessage !== null}
              className="primary-button w-full rounded-[1.4rem] px-6 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Generate Preview
            </button>
          </section>

          <section className="space-y-6">
            <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Preview board</p>
                  <h2 className="font-display mt-1 text-2xl font-semibold text-slate-900">See the chart before you buy</h2>
                </div>
                <div className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Watermarked sample
                </div>
              </div>

              {activeQualityWarnings.length > 0 && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {activeQualityWarnings[0]}
                </div>
              )}

              {state.imageBase64 ? (
                <div className="preview-frame relative h-72 w-full rounded-[1.5rem] p-3">
                  <img
                    src={state.imageBase64}
                    alt="Source preview"
                    className="h-full w-full rounded-[1.1rem] object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div
                    className="absolute inset-3 rounded-[1.1rem]"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(43,33,64,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(43,33,64,0.16) 1px, transparent 1px)',
                      backgroundSize: '12px 12px',
                      backgroundPosition: '0 0, 0 0',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              ) : (
                <div className="preview-frame flex min-h-72 items-center justify-center rounded-[1.5rem] px-6 text-center text-sm leading-6 text-slate-500">
                  Your uploaded image preview appears here once you add a photo.
                </div>
              )}
            </div>

            <div className="crochet-card-soft rounded-[1.75rem] p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Decorative details</p>
              <h3 className="font-display mt-2 text-2xl font-semibold text-slate-900">A brighter workspace</h3>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Studio color references and crochet image texture keep the workspace centered on yarn and finished blanket art.
              </p>
              <div className="mt-4 flex items-center gap-2">
                {HERO_SWATCHES.map((swatch) => (
                  <span
                    key={swatch.name}
                    className="h-6 w-10 rounded-full border border-white/80 shadow-sm"
                    style={{ backgroundColor: swatch.hex }}
                    aria-label={swatch.name}
                    title={swatch.name}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {STUDIO_THEME_IMAGES.map((item) => (
                  <div
                    key={`mini-${item.label}`}
                    className="h-20 rounded-xl border border-white/60 bg-cover bg-center"
                    style={{ backgroundImage: `url(${item.src})` }}
                    aria-label={item.label}
                    title={item.label}
                  />
                ))}
              </div>
            </div>

            {state.previewData && (
              <>
                <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-2xl font-semibold text-slate-900">{state.previewData.title}</h3>
                    <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                      {state.previewData.totalRows} rows in chart
                    </div>
                  </div>

                  <div className="preview-frame relative h-[460px] rounded-[1.5rem] p-3">
                    <div
                      className="h-full w-full rounded-[1rem] bg-white/70 [&>svg]:h-full [&>svg]:w-full"
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

                <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl font-semibold text-slate-900">Color legend</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Preview includes {state.previewData.colorLegend.length} of {state.previewData.totalLegendCount} colors.
                        {state.previewData.hiddenLegendCount > 0
                          ? ` Purchase the PDF to unlock the remaining ${state.previewData.hiddenLegendCount} colors and full yarn inventory.`
                          : ' Purchase the PDF to unlock the complete pattern and yarn inventory.'}
                      </p>
                    </div>
                    <div className="flex -space-x-2">
                      {state.previewData.colorLegend.slice(0, 5).map((entry, index) => (
                        <span
                          key={`${entry.symbol}-${index}`}
                          className="swatch-dot !h-6 !w-6"
                          style={{ backgroundColor: entry.hex }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-[1.25rem] border border-slate-200/60 bg-white/70">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50/80 text-slate-700">
                        <tr>
                          <th className="px-4 py-3">Color</th>
                          <th className="px-4 py-3">Symbol</th>
                          <th className="px-4 py-3">Yarn Color</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.previewData.colorLegend.map((entry, index) => (
                          <tr key={`${entry.symbol}-${entry.hex}-${index}`} className="border-t border-slate-100/90">
                            <td className="px-4 py-3">
                              <span
                                className="inline-block h-6 w-6 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: entry.hex }}
                                aria-label={`Color ${entry.hex}`}
                              />
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{entry.symbol}</td>
                            <td className="px-4 py-3 text-slate-700">{getYarnDisplayName(entry)}</td>
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
                  className="success-button w-full rounded-[1.4rem] px-6 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
