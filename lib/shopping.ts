import type { PatternData, ShoppingListItem } from './types';
import { getYarnWeightConfig } from './yarnWeight';

const AMAZON_SEARCH_URL = 'https://www.amazon.com/s';
const AMAZON_DEFAULT_QUERY = 'crochet supplies';
const AMAZON_FALLBACK_ASSOCIATE_TAG = 'changeme-20';

const MICHAELS_SEARCH_URL = 'https://www.michaels.com/search';
const MICHAELS_DEFAULT_QUERY = 'crochet supplies';
// Michaels CJ advertiser ID (Commission Junction program)
const MICHAELS_CJ_ADVERTISER_ID = '10045459';
const CJ_CLICK_BASE = 'https://www.anrdoezrs.net/click';
const DIGITS_ONLY = /^\d+$/;
const AMAZON_ASSOCIATE_TAG = /^[a-z0-9][a-z0-9-]{1,48}-20$/i;

function getAmazonAssociateTag(): string {
  const envTag =
    process.env.AMAZON_ASSOCIATE_TAG ??
    process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG ??
    process.env.AMAZON_AFFILIATE_TAG;

  const tag = envTag?.trim();
  if (!tag || tag.length === 0) {
    return AMAZON_FALLBACK_ASSOCIATE_TAG;
  }

  return AMAZON_ASSOCIATE_TAG.test(tag) ? tag : AMAZON_FALLBACK_ASSOCIATE_TAG;
}

function getMichaelsCjPublisherId(): string | null {
  const id = process.env.MICHAELS_CJ_PUBLISHER_ID?.trim();
  if (!id || id.length === 0) {
    return null;
  }

  return DIGITS_ONLY.test(id) ? id : null;
}

function getMichaelsCjAdvertiserId(): string {
  const id = process.env.MICHAELS_CJ_ADVERTISER_ID?.trim();
  if (!id || id.length === 0) {
    return MICHAELS_CJ_ADVERTISER_ID;
  }

  return DIGITS_ONLY.test(id) ? id : MICHAELS_CJ_ADVERTISER_ID;
}

function sanitizeQuery(query: string): string {
  return query
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

// Keep old name as an alias so existing callers aren't broken
function sanitizeAmazonQuery(query: string): string {
  return sanitizeQuery(query);
}

function buildCjClickUrl(targetUrl: string, publisherId: string, advertiserId: string): string {
  const cjClickUrl = new URL(`${CJ_CLICK_BASE}-${publisherId}-${advertiserId}`);
  cjClickUrl.searchParams.set('url', targetUrl);
  return cjClickUrl.toString();
}

function createAmazonSearchUrl(query: string): string {
  const sanitizedQuery = sanitizeAmazonQuery(query) || AMAZON_DEFAULT_QUERY;
  const url = new URL(AMAZON_SEARCH_URL);

  url.searchParams.set('k', sanitizedQuery);
  url.searchParams.set('tag', getAmazonAssociateTag());
  url.searchParams.set('linkCode', 'll2');
  url.searchParams.set('language', 'en_US');
  url.searchParams.set('ref', 'as_li_ss_tl');

  return url.toString();
}

function createMichaelsSearchUrl(query: string): string {
  const sanitizedQuery = sanitizeQuery(query) || MICHAELS_DEFAULT_QUERY;

  // Direct Michaels search URL
  const targetUrl = new URL(MICHAELS_SEARCH_URL);
  targetUrl.searchParams.set('q', sanitizedQuery);

  const publisherId = getMichaelsCjPublisherId();

  // If a CJ publisher ID is configured, wrap with the CJ affiliate deep link
  if (publisherId) {
    const advertiserId = getMichaelsCjAdvertiserId();
    return buildCjClickUrl(targetUrl.toString(), publisherId, advertiserId);
  }

  return targetUrl.toString();
}

function pluralize(unit: string, count: number): string {
  return count === 1 ? unit : `${unit}s`;
}

function buildYarnQuery(title: string, yarnWeightLabel: string): string {
  return `${title} yarn skein ${yarnWeightLabel}`;
}

export function buildAmazonShoppingList(pattern: PatternData): ShoppingListItem[] {
  const weightConfig = getYarnWeightConfig(pattern.yarnWeight);
  const yarnItems = pattern.inventory
    .filter((entry) => entry.skeinsNeeded > 0)
    .map((entry) => {
      const yarnTitle = entry.yarnBrand && entry.yarnColorName
        ? `${entry.yarnBrand} ${entry.yarnColorName}`
        : entry.yarnColorName
          ? entry.yarnColorName
          : `Yarn color ${entry.symbol}`;

      const quantity = Math.max(1, entry.skeinsNeeded);
      const query = buildYarnQuery(yarnTitle, weightConfig.label);

      return {
        id: `yarn-${entry.paletteIndex}`,
        category: 'yarn' as const,
        title: yarnTitle,
        quantity,
        unit: 'skein',
        query,
        amazonSearchUrl: createAmazonSearchUrl(query),
        michaelsSearchUrl: createMichaelsSearchUrl(query),
        notes: `Approx. ${Math.ceil(entry.yardsNeeded)} yards needed for this color`,
      } satisfies ShoppingListItem;
    });

  const baseToolItems: ShoppingListItem[] = [
    {
      id: 'tool-hook',
      category: 'tool',
      title: `${pattern.hookSize} crochet hook`,
      quantity: 1,
      unit: 'hook',
      query: `${pattern.hookSize} crochet hook ergonomic`,
      amazonSearchUrl: createAmazonSearchUrl(`${pattern.hookSize} crochet hook ergonomic`),
      michaelsSearchUrl: createMichaelsSearchUrl(`${pattern.hookSize} crochet hook`),
    },
    {
      id: 'tool-needle',
      category: 'tool',
      title: 'Large-eye tapestry needles',
      quantity: 1,
      unit: 'set',
      query: 'large eye tapestry needles yarn weaving',
      amazonSearchUrl: createAmazonSearchUrl('large eye tapestry needles yarn weaving'),
      michaelsSearchUrl: createMichaelsSearchUrl('tapestry needles yarn'),
    },
    {
      id: 'tool-markers',
      category: 'tool',
      title: 'Locking stitch markers',
      quantity: 1,
      unit: 'pack',
      query: 'locking stitch markers for crochet',
      amazonSearchUrl: createAmazonSearchUrl('locking stitch markers for crochet'),
      michaelsSearchUrl: createMichaelsSearchUrl('locking stitch markers crochet'),
    },
    {
      id: 'tool-scissors',
      category: 'tool',
      title: 'Yarn snips or embroidery scissors',
      quantity: 1,
      unit: 'pair',
      query: 'small embroidery scissors yarn snips',
      amazonSearchUrl: createAmazonSearchUrl('small embroidery scissors yarn snips'),
      michaelsSearchUrl: createMichaelsSearchUrl('embroidery scissors yarn snips'),
    },
  ];

  return [...yarnItems, ...baseToolItems].map((item) => ({
    ...item,
    unit: pluralize(item.unit, item.quantity),
  }));
}
