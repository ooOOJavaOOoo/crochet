import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const patternModule = await import('../lib/pattern.ts');
const quantizeImage = patternModule.quantizeImage ?? patternModule.default?.quantizeImage;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const wolfPath = path.resolve(__dirname, '..', 'wolf.png');
  const wolfBuffer = await readFile(wolfPath);
  const imageBase64 = `data:image/png;base64,${wolfBuffer.toString('base64')}`;

  const pattern = await quantizeImage({
    imageBase64,
    gridWidth: 120,
    gridHeight: 160,
    colorCount: 12,
    stitchType: 'tapestry',
    yarnWeight: 'worsted',
    hookSize: '5.0mm (H-8)',
    renderMode: 'photo-gradient',
    flattenBackgroundRegions: true,
  });

  const { stitchGrid, palette } = pattern;

  function isWhiteLikeHex(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const avg = (r + g + b) / 3;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const blueBias = b - r;
    return avg >= 214 && min >= 198 && (max - min) <= 34 && blueBias <= 16;
  }

  function isGrayLikeHex(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    if (isWhiteLikeHex(hex)) return false;
    const avg = (r + g + b) / 3;
    return Math.abs(r - g) <= 24 && Math.abs(g - b) <= 24 && avg >= 96 && avg <= 232;
  }

  function analyzeWindow(name, x0, x1, y0, y1) {
    let white = 0;
    let gray = 0;
    let other = 0;
    const counts = new Map();

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = stitchGrid[y]?.[x];
        if (idx === undefined) {
          other++;
          continue;
        }

        const hex = (palette[idx]?.hex || '').toLowerCase();
        if (!counts.has(hex)) counts.set(hex, 0);
        counts.set(hex, counts.get(hex) + 1);

        if (isWhiteLikeHex(hex)) {
          white++;
        } else if (isGrayLikeHex(hex)) {
          gray++;
        } else {
          other++;
        }
      }
    }

    const total = white + gray + other;
    const top3 = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    console.log(`\n${name}`);
    console.log(`[x:${x0}..${x1}, y:${y0}..${y1}]`);
    console.log(`Total cells: ${total}`);
    console.log(`White-like:  ${white} (${(white / total * 100).toFixed(1)}%)`);
    console.log(`Gray-like:   ${gray} (${(gray / total * 100).toFixed(1)}%)`);
    console.log(`Other:       ${other} (${(other / total * 100).toFixed(1)}%)`);
    console.log(`Top 3 colors:`);
    top3.forEach(([hex, cnt]) => {
      console.log(`  ${hex}: ${cnt} cells`);
    });
  }

  analyzeWindow('PRIMARY WINDOW (original diagnostic)', 72, 86, 118, 132);
  analyzeWindow('FOCUSED WINDOW (user-highlighted snout area)', 74, 84, 121, 130);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
