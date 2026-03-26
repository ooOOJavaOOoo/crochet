'use client';

import { ChangeEvent, FormEvent, useEffect, useReducer } from 'react';

++
interface PaletteEntry {
  index: number;
  hex: string;
  symbol: string;
  pixelCount: number;
  name?: string;
  yarnBrand?: string;
  yarnColorName?: string;
}
      dispatch({ type: 'SetLoadingMessage', loadingMessage: 'Getting AI recommendations...' });

      const aspectRatio = await getImageAspectRatio(state.imageBase64);
      const hexColors = state.patternData?.palette.map((entry) => entry.hex) ?? [];

      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hexColors,
          aspectRatio,
          yarnBrand: state.brandId,
        }),
      });

      const data = await getJsonOrThrow<{
        size: { gridWidth: number; gridHeight: number; name: string };
        title?: string;
      }>(res);

      const nextWidth = data.size.gridWidth;
      const nextHeight = data.size.gridHeight;
      const nextPreset = closestPresetIndex(nextWidth, nextHeight);

      dispatch({ type: 'SetPreset', presetIndex: nextPreset, width: nextWidth, height: nextHeight });
      dispatch({ type: 'SetToast', toast: `AI recommends: ${data.size.name}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch AI recommendations.';
      dispatch({ type: 'SetError', error: message });
    } finally {
      dispatch({ type: 'SetLoadingMessage', loadingMessage: null });
    }
  };

  const handleGeneratePreview = async () => {
    if (!state.imageBase64) {
      dispatch({ type: 'SetError', error: 'Please upload or generate an image first.' });
      return;
    }

    if (state.gridWidth < 10 || state.gridHeight < 10) {
      dispatch({ type: 'SetError', error: 'Grid dimensions must be at least 10 x 10.' });
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
          brandId: state.brandId || undefined,
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tapestry Crochet Pattern Generator</h1>
            <p className="mt-1 text-sm text-slate-600">Upload or generate an image, tune your settings, then preview and purchase the full PDF.</p>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'Reset' })}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Start Over
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">1. Choose Your Image</h2>

              <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SetImageMode', imageMode: 'upload' })}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    state.imageMode === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Upload Photo
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SetImageMode', imageMode: 'ai' })}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    state.imageMode === 'ai' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Generate with AI
                </button>
              </div>

              {state.imageMode === 'upload' ? (
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
                  {state.imageBase64 && (
                    <img
                      src={state.imageBase64}
                      alt="Selected source"
                      className="h-48 w-full rounded-lg border border-slate-200 object-cover"
                    />
                  )}
                </div>
              ) : (
                <form onSubmit={handleGenerateImage} className="space-y-3">
                  <label htmlFor="prompt" className="block text-sm font-medium text-slate-700">
                    Describe your image
                  </label>
                  <textarea
                    id="prompt"
                    rows={4}
                    value={state.aiPrompt}
                    onChange={(event) => dispatch({ type: 'SetAiPrompt', aiPrompt: event.target.value })}
                    placeholder="Example: Golden retriever in a flower field at sunset"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                  <button
                    type="submit"
                    disabled={!state.aiPrompt.trim() || state.loadingMessage !== null}
                    className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Generate Image
                  </button>
                </form>
              )}
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
                        min={10}
                        max={1000}
                        value={state.gridWidth}
                        onChange={(event) =>
                          dispatch({ type: 'SetGridWidth', gridWidth: Number(event.target.value) || 10 })
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
                        min={10}
                        max={1000}
                        value={state.gridHeight}
                        onChange={(event) =>
                          dispatch({ type: 'SetGridHeight', gridHeight: Number(event.target.value) || 10 })
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="color-count" className="mb-1 block text-sm font-medium text-slate-700">
                    Color count: {state.colorCount}
                  </label>
                  <input
                    id="color-count"
                    type="range"
                    min={2}
                    max={12}
                    value={state.colorCount}
                    onChange={(event) => dispatch({ type: 'SetColorCount', colorCount: Number(event.target.value) })}
                    className="w-full"
                  />
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

                <button
                  type="button"
                  onClick={handleRecommend}
                  disabled={!state.imageBase64 || state.loadingMessage !== null}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Get AI Recommendations
                </button>
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

              {state.imageBase64 ? (
                <img
                  src={state.imageBase64}
                  alt="Source preview"
                  className="h-64 w-full rounded-lg border border-slate-200 object-contain"
                />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                  Your uploaded or AI-generated image preview appears here.
                </div>
              )}
            </div>

            {state.previewData && (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-base font-semibold">{state.previewData.title}</h3>
                  <div
                    className="overflow-auto rounded-lg border border-slate-200 bg-white p-3"
                    dangerouslySetInnerHTML={{ __html: state.previewData.previewSvg }}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-base font-semibold">Color Legend</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          <th className="px-3 py-2">Color</th>
                          <th className="px-3 py-2">Symbol</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Hex</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.previewData.colorLegend.map((entry) => (
                          <tr key={`${entry.index}-${entry.hex}`} className="border-t border-slate-100">
                            <td className="px-3 py-2">
                              <span
                                className="inline-block h-5 w-5 rounded border border-slate-300"
                                style={{ backgroundColor: entry.hex }}
                                aria-label={`Color ${entry.hex}`}
                              />
                            </td>
                            <td className="px-3 py-2 font-semibold">{entry.symbol}</td>
                            <td className="px-3 py-2">{entry.yarnColorName || entry.name || '-'}</td>
                            <td className="px-3 py-2 font-mono uppercase">{entry.hex}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-base font-semibold">Yarn Inventory</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          <th className="px-3 py-2">Symbol</th>
                          <th className="px-3 py-2">Hex</th>
                          <th className="px-3 py-2">Yards</th>
                          <th className="px-3 py-2">Skeins</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.previewData.yarnSummary.map((item) => (
                          <tr key={`${item.paletteIndex}-${item.hex}`} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-semibold">{item.symbol}</td>
                            <td className="px-3 py-2 font-mono uppercase">{item.hex}</td>
                            <td className="px-3 py-2">{item.yardsNeeded.toFixed(1)}</td>
                            <td className="px-3 py-2">{item.skeinsNeeded.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-300 bg-slate-100 p-5 shadow-sm">
                  <p className="text-sm text-slate-700">
                    Showing rows 1-20 of {state.previewData.totalRows} - Full pattern includes stitch chart, row instructions &amp; inventory PDF
                  </p>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={state.loadingMessage !== null || state.step === 'buying'}
                    className="mt-4 w-full rounded-lg bg-emerald-600 px-5 py-3 text-lg font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Buy Full PDF - $4.99
                  </button>
                </div>
              </>
            )}

            {state.error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{state.error}</div>
            )}
          </section>
        </div>
      </main>

      {state.loadingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <svg
              className="mx-auto h-8 w-8 animate-spin text-violet-700"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M22 12a10 10 0 0 0-10-10v3a7 7 0 0 1 7 7h3Z"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-700">{state.loadingMessage}</p>
          </div>
        </div>
      )}

      {state.toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-violet-700 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {state.toast}
        </div>
      )}
    </div>
  );
}
