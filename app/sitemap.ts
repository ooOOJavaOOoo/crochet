import type { MetadataRoute } from 'next';

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

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
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
}
