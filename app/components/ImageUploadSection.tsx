'use client';

import { ChangeEvent } from 'react';

type ImageInputMode = 'upload' | 'ai-generate' | 'ai-edit';

interface ImageUploadSectionProps {
  imageInputMode: ImageInputMode;
  aiImagePrompt: string;
  loadingMessage: string | null;
  onModeChange: (mode: ImageInputMode) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onAiPromptChange: (prompt: string) => void;
  onAiAction: () => Promise<void>;
}

export default function ImageUploadSection({
  imageInputMode,
  aiImagePrompt,
  loadingMessage,
  onModeChange,
  onFileUpload,
  onAiPromptChange,
  onAiAction,
}: ImageUploadSectionProps) {
  return (
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

      <div className="space-y-4">
        {/* Image source selector */}
        <div>
          <p className="form-label mb-2">Image source</p>
          <div className="segmented-control">
            <button
              type="button"
              onClick={() => onModeChange('upload')}
              className={`segmented-button ${imageInputMode === 'upload' ? 'segmented-button-active' : ''}`}
            >
              Upload Only
            </button>
            <button
              type="button"
              onClick={() => onModeChange('ai-generate')}
              className={`segmented-button ${imageInputMode === 'ai-generate' ? 'segmented-button-active' : ''}`}
            >
              AI Generate
            </button>
            <button
              type="button"
              onClick={() => onModeChange('ai-edit')}
              className={`segmented-button ${imageInputMode === 'ai-edit' ? 'segmented-button-active' : ''}`}
            >
              AI Edit Upload
            </button>
          </div>
        </div>

        {/* File upload input */}
        {imageInputMode !== 'ai-generate' && (
          <div>
            <label htmlFor="photo" className="form-label">
              Upload photo (JPEG, PNG, WebP up to 10MB)
            </label>
            <input
              id="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileUpload}
              className="form-input block"
            />
          </div>
        )}

        {/* AI prompt section */}
        {imageInputMode !== 'upload' && (
          <div className="space-y-3 rounded-[1.2rem] border border-[color:var(--border-soft)] bg-white/70 px-4 py-4">
            <label htmlFor="ai-prompt" className="form-label">
              AI prompt
            </label>
            <textarea
              id="ai-prompt"
              value={aiImagePrompt}
              onChange={(event) => onAiPromptChange(event.target.value)}
              className="form-input min-h-24"
              placeholder={
                imageInputMode === 'ai-generate'
                  ? 'Example: a cozy fox wearing a scarf in a forest, clean shapes, bold contrast, crochet-friendly color blocks'
                  : 'Example: simplify the background, keep the dog face crisp, increase contrast between subject and sky'
              }
            />
            <button
              type="button"
              onClick={onAiAction}
              disabled={loadingMessage !== null}
              className="secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
            >
              {imageInputMode === 'ai-generate' ? 'Generate AI Image' : 'Apply AI Edit'}
            </button>
          </div>
        )}

        {/* Image source guidance */}
        <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
          Portraits, pets, florals, and graphic art all work. Use AI mode to generate a fresh image or edit your uploaded one before chart conversion.
        </p>
      </div>
    </div>
  );
}
