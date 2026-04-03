import { z } from 'zod';
import { kv } from '@vercel/kv';
import { quantizeImage } from '@/lib/pattern';
import { generatePatternId } from '@/lib/types';
import { DEFAULT_OUTPUT_TYPE, OUTPUT_TYPES } from '@/lib/types';
import type { PatternData, StoredPattern, YarnWeight } from '@/lib/types';
import { type QuantizeResult } from '@/lib/pattern';
import { generateTitle } from '@/lib/prompts/titleGenerator';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
import { getFriendlyColorName, findYarnColorByName, getSkeinYardage } from '@/lib/yarn';
import { matchColors, type YarnBrand } from '@/lib/prompts/colorMatcher';
import { getDefaultHook, DEFAULT_YARN_WEIGHT } from '@/lib/yarnWeight';
import { getOutputTypeLabel } from '@/lib/outputType';

export const runtime = 'nodejs';
export const maxDuration = 60;

const schema = z.object({
  imageBase64: z.string().min(1),
  gridWidth: z.number().int().min(20).max(432),
  gridHeight: z.number().int().min(20).max(432),
  colorCount: z.number().int().min(0).max(30), // 0 = auto-detect
  brandId: z.string().min(1),
  selectedYarnColorIds: z.array(z.string().min(1)).optional(),
  stitchType: z.enum(['tapestry', 'c2c', 'knitting', 'cross-stitch']).optional().default('tapestry'),
  outputType: z.enum(OUTPUT_TYPES).optional().default(DEFAULT_OUTPUT_TYPE),
  customOutputTypeLabel: z.string().trim().min(2).max(40).optional(),
  yarnWeight: z.enum(['fingering', 'sport', 'dk', 'worsted', 'bulky', 'super-bulky']).optional(),
  hookSize: z.string().max(30).optional(),
  renderMode: z.enum(['graphic-clean-art', 'photo-gradient']).optional().default('photo-gradient'),
  flattenBackgroundRegions: z.boolean().optional().default(false),
  useAiColorMatch: z.boolean().optional().default(false),
  autoDetectYarnSetup: z.boolean().optional().default(false),
}).superRefine((value, ctx) => {
  if (value.outputType === 'other' && !value.customOutputTypeLabel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customOutputTypeLabel'],
      message: 'Please provide a custom output type label when outputType is "other".',
    });
  }
});

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request): Promise<Response> {
  try {
    const rateLimit = await checkRateLimit(request, 'pattern');
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues }, { status: 400 });
    }

    const {
      imageBase64,
      gridWidth,
      gridHeight,
      colorCount,
      brandId,
      selectedYarnColorIds,
      stitchType,
      outputType,
      customOutputTypeLabel,
      yarnWeight,
      hookSize,
      renderMode,
      flattenBackgroundRegions,
      useAiColorMatch,
      autoDetectYarnSetup,
    } = parsed.data;

    const inferredYarnWeight: YarnWeight = autoDetectYarnSetup
      ? gridWidth * gridHeight >= 55_000
        ? 'sport'
        : gridWidth * gridHeight >= 28_000
          ? 'dk'
          : DEFAULT_YARN_WEIGHT
      : (yarnWeight ?? DEFAULT_YARN_WEIGHT);

    const inferredHookSize = autoDetectYarnSetup
      ? getDefaultHook(inferredYarnWeight, stitchType)
      : hookSize;

    // Strip optional data URI prefix and validate decoded size
    const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const decodedByteLength = Math.floor((base64Data.length * 3) / 4);
    if (decodedByteLength > MAX_IMAGE_BYTES) {
      return Response.json(
        { error: 'Image exceeds maximum allowed size of 10 MB' },
        { status: 413 },
      );
    }

    const rawPattern: QuantizeResult = await quantizeImage({
      imageBase64: base64Data,
      gridWidth,
      gridHeight,
      colorCount,
      brandId,
      selectedYarnColorIds,
      stitchType,
      yarnWeight: inferredYarnWeight,
      hookSize: inferredHookSize,
      renderMode,
      flattenBackgroundRegions,
    });

    // Apply AI color matching if requested
    if (useAiColorMatch && rawPattern.palette.length > 0) {
      const hexColors = rawPattern.palette.map((p) => p.hex);
      const colorResult = await matchColors({ hexColors, yarnBrand: brandId as YarnBrand | undefined });
      const BRAND_NAME_TO_ID: Record<string, string> = {
        'lion brand': 'lion-brand',
        'red heart': 'red-heart',
        'caron': 'caron',
        'paintbox': 'paintbox',
      };
      for (let i = 0; i < rawPattern.palette.length; i++) {
        const aiColor = colorResult.colors[i];
        if (!aiColor) continue;
        const matchedBrandId = BRAND_NAME_TO_ID[aiColor.yarnMatch.brand.toLowerCase()];
        if (!matchedBrandId) continue;
        const yarnRecord = findYarnColorByName(matchedBrandId, aiColor.yarnMatch.colorName);
        if (yarnRecord) {
          rawPattern.palette[i].hex = yarnRecord.hex;
          rawPattern.palette[i].name = yarnRecord.name;
          rawPattern.palette[i].yarnBrand = yarnRecord.brand;
          rawPattern.palette[i].yarnColorName = yarnRecord.name;
        }
      }

      // Re-deduplicate: AI matching may have assigned the same yarn to multiple palette
      // entries. Merge them now so the materials list has no duplicate color rows.
      const mergeKeyToNewIdx = new Map<string, number>();
      const mergedPalette: typeof rawPattern.palette = [];
      const oldToNewIdx = new Map<number, number>();

      for (const entry of rawPattern.palette) {
        const key =
          entry.yarnBrand && entry.yarnColorName
            ? `${entry.yarnBrand}::${entry.yarnColorName}`
            : entry.hex;

        if (mergeKeyToNewIdx.has(key)) {
          const newIdx = mergeKeyToNewIdx.get(key)!;
          mergedPalette[newIdx].pixelCount += entry.pixelCount;
          oldToNewIdx.set(entry.index, newIdx);
        } else {
          const newIdx = mergedPalette.length;
          mergeKeyToNewIdx.set(key, newIdx);
          mergedPalette.push({
            ...entry,
            index: newIdx,
            symbol: String.fromCharCode(65 + newIdx),
          });
          oldToNewIdx.set(entry.index, newIdx);
        }
      }

      if (mergedPalette.length < rawPattern.palette.length) {
        // Remap stitch grid to new indices
        rawPattern.stitchGrid = rawPattern.stitchGrid.map((row) =>
          row.map((idx) => oldToNewIdx.get(idx) ?? idx),
        );
        rawPattern.palette = mergedPalette;

        // Rebuild inventory by summing yards/stitches per merged group
        const skeinYardage = getSkeinYardage(brandId);
        const mergedInvMap = new Map<number, (typeof rawPattern.inventory)[0]>();

        for (const inv of rawPattern.inventory) {
          const newIdx = oldToNewIdx.get(inv.paletteIndex) ?? inv.paletteIndex;
          const p = mergedPalette[newIdx];
          if (mergedInvMap.has(newIdx)) {
            const existing = mergedInvMap.get(newIdx)!;
            existing.totalStitches += inv.totalStitches;
            existing.yardsNeeded += inv.yardsNeeded;
            existing.skeinsNeeded = Math.ceil(existing.yardsNeeded / skeinYardage);
          } else {
            mergedInvMap.set(newIdx, {
              ...inv,
              paletteIndex: newIdx,
              symbol: p.symbol,
              hex: p.hex,
              yarnBrand: p.yarnBrand,
              yarnColorName: p.yarnColorName,
            });
          }
        }

        rawPattern.inventory = mergedPalette.map((_, idx) => {
          const inv = mergedInvMap.get(idx);
          if (!inv) throw new Error(`Missing inventory for merged palette index ${idx}`);
          return inv;
        });
      }
    }

    const patternId = generatePatternId();

    const colorNames = rawPattern.palette.map(
      (p) => p.yarnColorName ?? p.name ?? getFriendlyColorName(p.hex),
    );
    const { title } = await generateTitle({
      colorNames,
      outputTypeLabel: getOutputTypeLabel(outputType, customOutputTypeLabel),
    });

    const patternData: PatternData = {
      patternId,
      ...rawPattern,
      title,
      outputType,
      customOutputTypeLabel,
      createdAt: new Date().toISOString(),
    };

    const storedPattern: StoredPattern = {
      ...patternData,
    };

    await kv.set(`pattern:${patternId}`, storedPattern, { ex: 172800 }); // 48 hours

    return Response.json(storedPattern satisfies PatternData, { status: 200 });
  } catch (err) {
    console.error('[POST /api/pattern] generation failed', err);
    return Response.json({ error: 'Pattern generation failed' }, { status: 500 });
  }
}
