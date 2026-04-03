'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PatternData } from '@/lib/types';

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

interface EditorPayload {
  patternData: PatternData;
  previewData: PreviewData;
}

interface PaidPatternEditorProps {
  editToken: string;
}

function colorName(entry: { yarnBrand?: string; yarnColorName?: string; name?: string; hex: string }): string {
  if (entry.yarnBrand && entry.yarnColorName) {
    return `${entry.yarnBrand} - ${entry.yarnColorName}`;
  }
  return entry.yarnColorName ?? entry.name ?? entry.hex;
}

export default function PaidPatternEditor({ editToken }: PaidPatternEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patternData, setPatternData] = useState<PatternData | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState(0);
  const [aiInstruction, setAiInstruction] = useState('');
  const [isApplyingAi, setIsApplyingAi] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dimensions = useMemo(() => {
    if (!patternData) {
      return { width: 0, height: 0, cell: 8 };
    }

    const maxCanvas = 640;
    const cell = Math.max(2, Math.floor(maxCanvas / Math.max(patternData.dimensions.width, patternData.dimensions.height)));
    return {
      width: patternData.dimensions.width,
      height: patternData.dimensions.height,
      cell,
    };
  }, [patternData]);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        setLoading(true);
        const res = await fetch(`/api/editor/pattern?edit_token=${encodeURIComponent(editToken)}`);
        const data = (await res.json()) as EditorPayload | { error?: string };
        if (!res.ok || !('patternData' in data)) {
          throw new Error(('error' in data && typeof data.error === 'string') ? data.error : 'Failed to load paid editor.');
        }

        setPatternData(data.patternData);
        setPreviewData(data.previewData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load editor.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [editToken]);

  useEffect(() => {
    if (!patternData || !canvasRef.current) {
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      return;
    }

    const { width, height, cell } = dimensions;
    canvasRef.current.width = width * cell;
    canvasRef.current.height = height * cell;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const paletteIdx = patternData.stitchGrid[row]?.[col] ?? 0;
        ctx.fillStyle = patternData.palette[paletteIdx]?.hex ?? '#CCCCCC';
        const drawY = (height - 1 - row) * cell;
        ctx.fillRect(col * cell, drawY, cell, cell);
      }
    }

    ctx.strokeStyle = 'rgba(80,80,80,0.16)';
    ctx.lineWidth = 1;
    for (let col = 1; col < width; col++) {
      ctx.beginPath();
      ctx.moveTo(col * cell, 0);
      ctx.lineTo(col * cell, height * cell);
      ctx.stroke();
    }
    for (let row = 1; row < height; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * cell);
      ctx.lineTo(width * cell, row * cell);
      ctx.stroke();
    }
  }, [patternData, dimensions]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!patternData || !canvasRef.current) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / Math.max(rect.width, 1);
    const scaleY = canvasRef.current.height / Math.max(rect.height, 1);

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const col = Math.floor(x / dimensions.cell);
    const flippedRow = Math.floor(y / dimensions.cell);
    const row = patternData.dimensions.height - 1 - flippedRow;

    if (row < 0 || row >= patternData.dimensions.height || col < 0 || col >= patternData.dimensions.width) {
      return;
    }

    const updatedGrid = patternData.stitchGrid.map((gridRow, idx) => {
      if (idx !== row) return gridRow;
      const newRow = [...gridRow];
      newRow[col] = selectedPaletteIndex;
      return newRow;
    });

    setPatternData({ ...patternData, stitchGrid: updatedGrid });
  };

  const saveEdits = async () => {
    if (!patternData) return;

    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/editor/pattern', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editToken, patternData }),
      });

      const data = (await res.json()) as EditorPayload | { error?: string };
      if (!res.ok || !('patternData' in data)) {
        throw new Error(('error' in data && typeof data.error === 'string') ? data.error : 'Failed to save changes.');
      }

      setPatternData(data.patternData);
      setPreviewData(data.previewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const applyAiEdit = async () => {
    if (!patternData || !aiInstruction.trim()) {
      return;
    }

    try {
      setIsApplyingAi(true);
      setError(null);
      const res = await fetch('/api/editor/ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editToken,
          instruction: aiInstruction.trim(),
          patternData,
        }),
      });

      const data = (await res.json()) as { patternData?: PatternData; error?: string };
      if (!res.ok || !data.patternData) {
        throw new Error(typeof data.error === 'string' ? data.error : 'AI edit failed.');
      }

      setPatternData(data.patternData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI edit failed.');
    } finally {
      setIsApplyingAi(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-white/70 p-4 text-sm text-[color:var(--text-secondary)]">
        Loading paid editor...
      </div>
    );
  }

  if (!patternData || !previewData) {
    return (
      <div className="rounded-2xl border border-[#9f3a2a]/30 bg-[#fff4f1] p-4 text-sm text-[#9f3a2a]">
        {error ?? 'Unable to load post-purchase editor.'}
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[color:var(--border-soft)] bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold text-[color:var(--foreground)]">Edit Before Final PDF</h3>
          <p className="text-sm text-[color:var(--text-secondary)]">
            Paid preview is unwatermarked. Click stitches to recolor and save before download.
          </p>
        </div>
        <button
          type="button"
          onClick={saveEdits}
          disabled={saving || isApplyingAi}
          className="rounded-xl border border-[color:var(--border-soft)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand-primary)]"
        >
          {saving ? 'Saving...' : 'Save Edits'}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-[#9f3a2a]/30 bg-[#fff4f1] px-3 py-2 text-sm text-[#9f3a2a]">{error}</p>
      )}

      <div className="rounded-xl border border-[color:var(--border-soft)] bg-white p-2 overflow-auto">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="max-w-full h-auto cursor-crosshair rounded"
          aria-label="Editable stitch chart"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">Palette from inventory</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {patternData.palette.map((entry) => (
            <button
              key={entry.index}
              type="button"
              onClick={() => setSelectedPaletteIndex(entry.index)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left ${selectedPaletteIndex === entry.index ? 'border-[color:var(--brand-primary)] bg-[color:var(--surface-subtle)]' : 'border-[color:var(--border-soft)] bg-white'}`}
            >
              <span className="h-6 w-6 rounded-full border border-white shadow" style={{ backgroundColor: entry.hex }} />
              <span className="text-sm text-[color:var(--foreground)]">
                {entry.symbol} - {colorName({ ...entry, hex: entry.hex })}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[color:var(--border-soft)] bg-white p-3">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">AI Edit</p>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
          Describe a recolor intent, for example: make background symbols closer to sky blue.
        </p>
        <textarea
          value={aiInstruction}
          onChange={(event) => setAiInstruction(event.target.value)}
          className="form-input mt-2 min-h-20"
          placeholder="Example: make the background colors warmer and reduce strong contrast in shadows"
        />
        <button
          type="button"
          onClick={applyAiEdit}
          disabled={isApplyingAi || !aiInstruction.trim()}
          className="mt-2 rounded-xl border border-[color:var(--border-soft)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand-primary)] disabled:opacity-60"
        >
          {isApplyingAi ? 'Applying AI edit...' : 'Apply AI Edit'}
        </button>
      </div>
    </section>
  );
}
