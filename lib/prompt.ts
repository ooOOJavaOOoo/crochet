export type CrochetPromptOptions = {
  gridSize?: string;
  colorLimit?: 'auto' | 'reduced' | 'yarn-brand' | 'exact';
  yarnBrand?: string;
  yarnColors?: string;
  allowAugmentedColors?: boolean;
};

export function buildCrochetPrompt(options: CrochetPromptOptions) {
  const {
    gridSize,
    colorLimit = 'auto',
    yarnBrand = '',
    yarnColors = '',
    allowAugmentedColors = false,
  } = options;

  const gridInstruction = gridSize
    ? `Use grid size ${gridSize} (width x height in stitches).`
    : 'Suggest an appropriate grid size based on image detail.';

  let colorInstruction = 'Automatically select a palette that preserves clarity and contrast.';
  if (colorLimit === 'exact' && yarnColors) {
    colorInstruction = `Use exactly these yarn colors only (no substitutions): ${yarnColors}.`;
    if (allowAugmentedColors && yarnBrand) {
      colorInstruction += ` Augment with additional colors from the ${yarnBrand} palette if needed.`;
    }
  } else if (colorLimit === 'yarn-brand' && yarnBrand) {
    colorInstruction = `Match colors to the yarn brand ${yarnBrand} as closely as possible.`;
  } else if (colorLimit === 'reduced') {
    colorInstruction = 'Reduce palette while preserving clarity and contrast.';
  }

  return `You are an expert tapestry crochet pattern assistant. Convert the provided image into a complete tapestry crochet pattern plan.\n\n- ${gridInstruction}\n- ${colorInstruction}\n- Use single crochet throughout.\n- No increases or decreases.\n- Provide a color legend (symbol -> color).\n- Provide a grid with row-by-row instructions.\n- Include notes for color changes and carrying yarn.\n\nUser settings:\n- yarnBrand: ${yarnBrand || 'none'}\n- yarnColors: ${yarnColors || 'auto'}\n- allowAugmentedColors: ${allowAugmentedColors}\n\nGenerate the pattern now.`;
}
