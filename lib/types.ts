import { randomUUID } from 'crypto';

export interface PaletteEntry {
  index: number;
  hex: string;
  symbol: string;
  pixelCount: number;
  name?: string;
  yarnBrand?: string;
  yarnColorName?: string;
}

export interface YarnInventoryEntry {
  paletteIndex: number;
  hex: string;
  symbol: string;
  totalStitches: number;
  yardsNeeded: number;
  skeinsNeeded: number;
  yarnBrand?: string;
  yarnColorName?: string;
}

export interface PatternData {
  patternId: string;
  stitchGrid: number[][];
  palette: PaletteEntry[];
  dimensions: { width: number; height: number };
  inventory: YarnInventoryEntry[];
  aspectRatio: number;
  title: string;
  createdAt: string;
}

export interface StoredPattern extends PatternData {
  pdfBlobUrl: string;
}

export interface StoredCheckout {
  patternId: string;
  stripeSessionId: string;
  status: 'pending' | 'complete' | 'expired';
  downloadToken: string | null;
  createdAt: string;
}

export interface StoredDownloadToken {
  patternId: string;
  jti: string;
  issuedAt: string;
  used: boolean;
}

export type ApiError = { error: string };

export function generatePatternId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomUUID().replace(/-/g, '').slice(0, 8);
  return `pat_${timestamp}_${random}`;
}
