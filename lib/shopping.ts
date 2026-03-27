import type { PatternData, ShoppingListItem } from './types';
import { getYarnWeightConfig } from './yarnWeight';

function createAmazonSearchUrl(query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
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
    },
    {
      id: 'tool-needle',
      category: 'tool',
      title: 'Large-eye tapestry needles',
      quantity: 1,
      unit: 'set',
      query: 'large eye tapestry needles yarn weaving',
      amazonSearchUrl: createAmazonSearchUrl('large eye tapestry needles yarn weaving'),
    },
    {
      id: 'tool-markers',
      category: 'tool',
      title: 'Locking stitch markers',
      quantity: 1,
      unit: 'pack',
      query: 'locking stitch markers for crochet',
      amazonSearchUrl: createAmazonSearchUrl('locking stitch markers for crochet'),
    },
    {
      id: 'tool-scissors',
      category: 'tool',
      title: 'Yarn snips or embroidery scissors',
      quantity: 1,
      unit: 'pair',
      query: 'small embroidery scissors yarn snips',
      amazonSearchUrl: createAmazonSearchUrl('small embroidery scissors yarn snips'),
    },
  ];

  return [...yarnItems, ...baseToolItems].map((item) => ({
    ...item,
    unit: pluralize(item.unit, item.quantity),
  }));
}
