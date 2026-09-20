import fs from 'fs';
import path from 'path';

function nowIso() {
  return new Date().toISOString();
}

function buildUrlEntry(url, lastmod, changefreq = 'monthly', priority = 0.5, image) {
  let imgBlock = '';
  if (image) {
    imgBlock = `\n    <image:image>\n      <image:loc>${image.loc}</image:loc>\n      <image:caption>${image.caption}</image:caption>\n    </image:image>`;
  }

  return `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${imgBlock}\n  </url>`;
}

async function main() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crochetcanvas.com';
  let ids = [];

  if (process.env.SITEMAP_PATTERNS) {
    try {
      ids = JSON.parse(process.env.SITEMAP_PATTERNS);
    } catch (e) {
      console.warn('SITEMAP_PATTERNS is not valid JSON, falling back to placeholders');
    }
  }

  if (!ids || ids.length === 0) {
    // Try to load a local fixtures file if present
    const fixturesPath = path.join(process.cwd(), 'fixtures', 'pattern-ids.json');
    if (fs.existsSync(fixturesPath)) {
      try {
        ids = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
      } catch (e) {
        // ignore
      }
    }
  }

  if (!ids || ids.length === 0) {
    // Fallback example pattern IDs
    ids = ['abcd1234', 'xyz9876'];
  }

  const entries = [];
  // Home
  entries.push(buildUrlEntry(`${siteUrl}/`, nowIso(), 'daily', 1.0, {
    loc: `${siteUrl}/og-home.png`,
    caption: 'Crochet Canvas — Turn a photo into a stitch-ready crochet chart',
  }));

  // Success page
  entries.push(buildUrlEntry(`${siteUrl}/success`, nowIso(), 'weekly', 0.6));

  // Pattern pages
  for (const id of ids) {
    entries.push(buildUrlEntry(`${siteUrl}/pattern/${encodeURIComponent(id)}`, nowIso(), 'monthly', 0.5));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>\n`;

  const outDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`Wrote sitemap to ${outPath}`);
}

void main();
