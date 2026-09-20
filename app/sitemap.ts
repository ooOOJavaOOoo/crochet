import type { MetadataRoute } from 'next';
import { kv } from '@vercel/kv';

const DEFAULT_APP_URL = 'https://crochetcanvas.com';

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    return DEFAULT_APP_URL;
  }

  try {
    return new URL(raw).toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_APP_URL;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/success`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];

  // Attempt to include any recently stored pattern pages. The app stores patterns in Vercel KV
  // under keys like `pattern:${patternId}`. For performance and safety we read a pre-populated
  // index key `sitemap:patterns` (an array of pattern IDs) if present. If the key is missing
  // or KV isn't available, we simply return the base entries.
  try {
    const raw = await kv.get<string>('sitemap:patterns');
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      const patternEntries: MetadataRoute.Sitemap = ids.slice(0, 1000).map(
        (id) => ({
          url: `${siteUrl}/pattern/${encodeURIComponent(id)}`,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.5,
        })
      );

      return baseEntries.concat(patternEntries);
    }
  } catch (err) {
    // ignore KV errors and return base entries
  }

  return baseEntries;
}
