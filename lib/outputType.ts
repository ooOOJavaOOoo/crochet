import { type OutputType } from './types';

const OUTPUT_TYPE_LABELS: Record<Exclude<OutputType, 'other'>, string> = {
  blanket: 'Blanket',
  beanie: 'Beanie',
  scarf: 'Scarf',
  amigurumi: 'Amigurumi',
  top: 'Top',
  sweater: 'Sweater',
  shawl: 'Shawl',
  hat: 'Hat',
  bag: 'Bag',
  pillow: 'Pillow',
  'wall-hanging': 'Wall Hanging',
};

function toTitleCaseWords(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
}

export function getOutputTypeLabel(outputType: OutputType, customOutputTypeLabel?: string): string {
  if (outputType === 'other') {
    const cleaned = customOutputTypeLabel?.trim();
    return cleaned ? toTitleCaseWords(cleaned) : 'Custom';
  }
  return OUTPUT_TYPE_LABELS[outputType];
}
