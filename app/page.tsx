'use client';

import Image from 'next/image';
import { ChangeEvent, useEffect, useReducer } from 'react';
import type { PatternData, RenderMode, StitchType, YarnWeight } from '@/lib/types';
import AffiliateAdStrip from '@/app/components/AffiliateAdStrip';
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
  { value: 'i-love-this-yarn', label: 'I Love this Yarn' },
  { value: 'yarn-bee', label: 'Yarn Bee (DK)' },
];

const HERO_SWATCHES = [
  { name: 'Terracotta Thread', hex: '#b85c38' },
  { name: 'Oat Gold', hex: '#d89e58' },
  { name: 'Moss Loop', hex: '#35624a' },
  { name: 'Denim Stitch', hex: '#2e5e8a' },
  { name: 'Walnut Warmth', hex: '#6f4f3a' },
];

const CROCHET_FEATURES = [
  'Design faster while keeping your crochet style intact.',
  'Generate listing-ready visuals and clean chart previews.',
  'Deliver secure instant downloads when customers are ready to buy.',
];

const TRUST_POINTS = [
  'Secure checkout and instant PDF delivery',
  'Commercial-use friendly outputs for maker shops',
  'Edit and regenerate before purchasing your final pattern',
];

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Describe your idea',
    description: 'Upload your image and choose yarn-aware settings for size, stitch, and color count.',
  },
  {
    title: 'Generate pattern and preview',
    description: 'See a watermarked chart and color legend before committing to the full download.',
  },
  {
    title: 'Checkout and deliver',
    description: 'Unlock the complete PDF pattern and yarn inventory with one secure purchase.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'I turned a custom pet portrait order into a polished pattern in one evening and shipped it the same day.',
    author: 'Lina, Etsy seller',
  },
  {
    quote:
      'The previews help me catch color issues fast. I use less yarn and avoid rework on large blankets.',
    author: 'Monique, pattern designer',
  },
  {
    quote:
      'It feels like having a technical editor in my studio. The charts are cleaner than my old manual workflow.',
    author: 'Sofia, crochet instructor',
  },
];

const FAQ_ITEMS = [
  {
    question: 'Can I edit the generated pattern before I sell it?',
    answer:
      'Yes. You can regenerate with different settings and finalize your preferred chart before checkout.',
  },
  {
    question: 'Do I need advanced crochet skills to use this?',
    answer:
      'No. Presets and gauge hints help beginners start quickly, while advanced makers can fine-tune all settings.',
  },
  {
    question: 'What do I get after checkout?',
    answer:
      'You receive the full downloadable PDF pattern with both a stitch chart grid and row-by-row written instructions, plus the complete legend and yarn inventory details.',
  },
  {
    question: 'Are outputs okay for shop listings and commercial use?',
    answer:
      'Yes. Generated outputs are designed for maker storefront workflows including listing visuals and product-ready patterns.',
  },
];

const DEFAULT_APP_URL = 'https://crochetcanvas.com';

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    return DEFAULT_APP_URL;
  }

  try {
    return new URL(raw).toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_APP_URL;
  }
}

const siteUrl = getSiteUrl();

const STUDIO_THEME_IMAGES = [
  {
    label: 'Granny square texture',
    src: '/studio-granny-square.svg',
    palette: ['#e76f51', '#f4a261', '#f1c372', '#7bc8a4'],
  },
  {
    label: 'Colorful yarn wall',
    src: '/studio-yarn-wall.svg',
    palette: ['#b85c38', '#d89e58', '#2e5e8a', '#35624a'],
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
  renderMode: RenderMode;
  flattenBackgroundRegions: boolean;
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
  | { type: 'SetRenderMode'; renderMode: RenderMode }
  | { type: 'SetFlattenBackgroundRegions'; flattenBackgroundRegions: boolean }
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
  renderMode: 'photo-gradient',
  flattenBackgroundRegions: false,
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
    case 'SetRenderMode':
      return { ...state, renderMode: action.renderMode };
    case 'SetFlattenBackgroundRegions':
      return { ...state, flattenBackgroundRegions: action.flattenBackgroundRegions };
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
  const qaFlags = state.patternData?.qaFlags ?? [];
  const qualityMetrics = state.patternData?.qualityMetrics;
  const warningList = Array.from(new Set(activeQualityWarnings));
  const jsonLdPayloads = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Crochet Canvas',
      url: siteUrl,
      logo: `${siteUrl}/crochet-canvas-logo.svg`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Crochet Canvas',
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web',
      description:
        'Turn any image into a polished tapestry crochet pattern with chart previews, yarn planning, and instant PDF delivery.',
      offers: {
        '@type': 'Offer',
        price: '4.99',
        priceCurrency: 'USD',
      },
      url: siteUrl,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  ];

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
          renderMode: state.renderMode,
          flattenBackgroundRegions: state.flattenBackgroundRegions,
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
    <div className="crochet-page min-h-screen text-[color:var(--foreground)]">
      {jsonLdPayloads.map((payload, index) => (
        <script
          key={`jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
        />
      ))}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="crochet-hero mb-8 rounded-[2rem] px-6 py-7 sm:px-8 lg:px-10 lg:py-10">
          <div aria-hidden="true" className="skein skein-peach float-gentle right-6 top-6 hidden lg:block" />
          <div aria-hidden="true" className="skein skein-gold float-gentle-slow bottom-8 left-[48%] hidden lg:block" />
          <div aria-hidden="true" className="skein skein-mint float-gentle left-8 top-20 hidden xl:block" />
          <div aria-hidden="true" className="hook float-gentle-slow right-28 top-24 hidden lg:block rotate-[28deg]" />
          <div aria-hidden="true" className="hook float-gentle bottom-16 left-8 hidden xl:block -rotate-[24deg]" />

          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="relative z-10">
              <div className="mb-5 flex flex-wrap items-center gap-4">
                <Image
                  src="/crochet-canvas-logo.svg"
                  alt="Crochet Canvas"
                  width={270}
                  height={80}
                  className="h-12 w-auto sm:h-14"
                  priority
                />
                <span className="hero-badge text-xs font-semibold uppercase tracking-[0.22em]">Pattern Studio</span>
                <span className="rounded-full border border-[color:var(--border-soft)] bg-white/65 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-secondary)]">
                  Artisan Theme
                </span>
              </div>

              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-[color:var(--foreground)] sm:text-5xl lg:text-6xl">
                    Crochet Canvas turns any image into a chart you can stitch.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--text-secondary)] sm:text-lg">
                    Upload artwork, tune your yarn settings, and generate polished tapestry previews ready for your next project or shop listing.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => dispatch({ type: 'Reset' })}
                  className="secondary-button shrink-0 rounded-2xl px-4 py-3 text-sm font-semibold text-[color:var(--foreground)]"
                >
                  Start Over
                </button>
              </div>

              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                {CROCHET_FEATURES.map((feature) => (
                  <div key={feature} className="feature-pill rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--text-secondary)]">
                    {feature}
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {TRUST_POINTS.map((point) => (
                  <div key={point} className="trust-card rounded-2xl px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-secondary)]">
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <aside className="crochet-card-soft shine-surface relative z-10 rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--brand-secondary)]">Studio palette</p>
                  <h2 className="font-display mt-1 text-2xl font-semibold text-[color:var(--foreground)]">Craft-toned by default</h2>
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
                    aria-label={item.label}
                    title={item.label}
                  />
                ))}
              </div>

              <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-white/75 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--brand-secondary)]">Project recipe</p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Balanced for fast previews and polished finished PDFs.</p>
                  </div>
                  <div className="rounded-full bg-[color:var(--surface-subtle)] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--brand-primary)]">
                    Ready to stitch
                  </div>
                </div>

                <div className="space-y-3 text-sm text-[color:var(--text-secondary)]">
                  <div className="flex items-center justify-between rounded-2xl bg-[color:var(--surface-subtle)] px-4 py-3">
                    <span>Stitch mode</span>
                    <span className="font-semibold text-[color:var(--foreground)]">{state.stitchType === 'tapestry' ? 'Tapestry' : 'C2C'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-[color:var(--surface-subtle)] px-4 py-3">
                    <span>Yarn weight</span>
                    <span className="font-semibold text-[color:var(--foreground)]">{getYarnWeightConfig(state.yarnWeight).label}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-[color:var(--surface-subtle)] px-4 py-3">
                    <span>Grid size</span>
                    <span className="font-semibold text-[color:var(--foreground)]">{state.gridWidth} x {state.gridHeight}</span>
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

        <div id="generator" className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          <section className="space-y-6">
            <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-primary)]">Step 1</p>
                  <h2 className="font-display mt-1 text-2xl font-semibold text-[color:var(--foreground)]">Choose your image</h2>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                  <span className="swatch-dot !h-3 !w-3" style={{ backgroundColor: '#b85c38' }} />
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
                <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
                  Portraits, pets, florals, and graphic art all work. Start with a clean subject and strong contrast for the best chart.
                </p>
              </div>
            </div>

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

                <div className="rounded-[1.5rem] bg-gradient-to-r from-[rgba(184,92,56,0.08)] via-[rgba(216,158,88,0.12)] to-[rgba(46,94,138,0.08)] px-4 py-4">
                  <label htmlFor="color-count" className="form-label mb-2">
                    Number of colors: <span className="text-[color:var(--foreground)]">{state.colorCount}</span>
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
                        className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)]"
                      >
                        {swatch.name}
                      </span>
                    ))}
                  </div>
                  {state.colorCount <= 4 && (
                    <p className="mt-3 rounded-2xl border border-[color:var(--border-strong)] bg-white/70 px-3 py-3 text-xs leading-5 text-[color:var(--foreground)]">
                      Very low color counts can flatten details. Increase the slider if the preview feels too simplified.
                    </p>
                  )}
                </div>

                <div className="rounded-[1.5rem] border border-[color:var(--border-soft)] bg-white/80 px-4 py-4">
                  <p className="form-label">Render style</p>
                  <div className="segmented-control">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SetRenderMode', renderMode: 'graphic-clean-art' })}
                      className={`segmented-button ${state.renderMode === 'graphic-clean-art' ? 'segmented-button-active' : ''}`}
                    >
                      Graphic/Clean Art
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SetRenderMode', renderMode: 'photo-gradient' })}
                      className={`segmented-button ${state.renderMode === 'photo-gradient' ? 'segmented-button-active' : ''}`}
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
                      checked={state.flattenBackgroundRegions}
                      onChange={(event) =>
                        dispatch({
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
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
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
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
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
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-secondary)]">Preview board</p>
                  <h2 className="font-display mt-1 text-2xl font-semibold text-[color:var(--foreground)]">See the chart before you buy</h2>
                </div>
                <div className="rounded-full bg-[color:var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-secondary)]">
                  Watermarked sample
                </div>
              </div>

              {warningList.length > 0 && (
                <div className="mb-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]">
                  <p className="font-semibold">Quality checks</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {warningList.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
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

            {state.previewData && (
              <>
                <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-2xl font-semibold text-[color:var(--foreground)]">{state.previewData.title}</h3>
                    <div className="mono-meta rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                      {state.previewData.totalRows} rows in chart
                    </div>
                  </div>

                  <div className="preview-frame relative h-[460px] rounded-[1.5rem] p-3 !overflow-auto">
                    <div
                      className="h-full w-full rounded-[1rem] bg-white/70 p-2 [&>svg]:mx-auto [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-none [&>svg]:w-auto"
                      dangerouslySetInnerHTML={{ __html: state.previewData.previewSvg }}
                    />
                    {state.previewData.isWatermarked && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="rotate-[-18deg] text-3xl font-black uppercase tracking-[0.18em] text-[color:var(--foreground)]/20 sm:text-5xl">
                          Preview Only
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl font-semibold text-[color:var(--foreground)]">Color legend</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
                        Preview includes {state.previewData.colorLegend.length} of {state.previewData.totalLegendCount} colors.
                        {state.previewData.hiddenLegendCount > 0
                          ? ` Purchase the PDF to unlock the remaining ${state.previewData.hiddenLegendCount} colors and full yarn inventory.`
                          : ' Purchase the PDF to unlock the complete pattern and yarn inventory.'}
                      </p>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
                        Final PDF includes both formats: a full stitch chart grid and written row-by-row instructions.
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
                        {state.previewData.colorLegend.map((entry, index) => (
                          <tr key={`${entry.symbol}-${entry.hex}-${index}`} className="border-t border-[color:var(--border-soft)]/60">
                            <td className="px-4 py-3">
                              <span
                                className="inline-block h-6 w-6 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: entry.hex }}
                                aria-label={`Color ${entry.hex}`}
                              />
                            </td>
                            <td className="px-4 py-3 font-semibold text-[color:var(--foreground)]">{entry.symbol}</td>
                            <td className="px-4 py-3 text-[color:var(--text-secondary)]">{getYarnDisplayName(entry)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="crochet-card rounded-[1.75rem] p-5 sm:p-6">
                  <h3 className="font-display text-2xl font-semibold text-[color:var(--foreground)]">Pre-checkout QA</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                    Automated checks run on every generated chart to catch readability risks before purchase.
                  </p>

                  {qualityMetrics && (
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">Duplicate colors</p>
                        <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
                          {Math.round(qualityMetrics.duplicateColorRatio * 100)}%
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">Fragmentation</p>
                        <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
                          {Math.round(qualityMetrics.flatRegionFragmentation * 100)}%
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">Sky/tree continuity</p>
                        <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
                          {qualityMetrics.skyTreeContinuityScore}
                        </p>
                      </div>
                    </div>
                  )}

                  {qaFlags.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-4 py-3">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">Flags to review before checkout:</p>
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

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <article key={step.title} className="trust-card rounded-[1.5rem] p-5 sm:p-6">
              <p className="mono-meta text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">
                Step {index + 1}
              </p>
              <h3 className="font-display mt-3 text-2xl font-semibold text-[color:var(--foreground)]">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">{step.description}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-[color:var(--border-soft)] bg-white/60 p-6 sm:p-8">
          <AffiliateAdStrip filter={['hook', 'accessory']} heading="Recommended Hooks & Tools" />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <blockquote key={testimonial.author} className="trust-card rounded-[1.5rem] p-5 sm:p-6">
              <p className="text-base leading-7 text-[color:var(--foreground)]">&ldquo;{testimonial.quote}&rdquo;</p>
              <footer className="mono-meta mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--brand-secondary)]">
                {testimonial.author}
              </footer>
            </blockquote>
          ))}
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-[color:var(--border-soft)] bg-white/65 p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-3xl font-semibold text-[color:var(--foreground)]">Frequently asked questions</h2>
            <p className="mono-meta text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-secondary)]">
              Built for real maker workflows
            </p>
          </div>
          <div className="grid gap-3">
            {FAQ_ITEMS.map((faq) => (
              <details key={faq.question} className="faq-item rounded-2xl px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-[color:var(--foreground)]">{faq.question}</summary>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-[color:var(--border-soft)] bg-white/60 p-6 sm:p-8">
          <AffiliateAdStrip filter={['yarn', 'book']} heading="Yarns & Learning Resources" />
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-[color:var(--border-soft)] bg-gradient-to-r from-[rgba(184,92,56,0.11)] to-[rgba(53,98,74,0.11)] px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold text-[color:var(--foreground)] sm:text-4xl">
                Publish your first pattern today
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--text-secondary)] sm:text-base">
                Keep your generated draft momentum: start now, preview fast, and check out only when your chart looks right.
              </p>
            </div>
            <a href="#generator" className="primary-button rounded-2xl px-6 py-3 text-sm font-semibold text-white">
              Create My First Pattern
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

