'use client';

// ─────────────────────────────────────────────────────────────────────────────
// AffiliateAdStrip
// Displays curated crochet product recommendations with Amazon and Michaels
// affiliate search links. Affiliate links help support Crochet Canvas.
// ─────────────────────────────────────────────────────────────────────────────

const AMAZON_TAG = 'crochetcanvas-20';
const MICHAELS_CJ_ADVERTISER_ID = '10045459';
const DIGITS_ONLY = /^\d+$/;

function buildAmazonUrl(query: string): string {
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  url.searchParams.set('tag', AMAZON_TAG);
  url.searchParams.set('linkCode', 'll2');
  url.searchParams.set('language', 'en_US');
  return url.toString();
}

function buildMichaelsUrl(query: string): string {
  const target = new URL('https://www.michaels.com/search');
  target.searchParams.set('q', query);

  // Prefer configured CJ IDs, but fall back to direct Michaels search if unavailable.
  const publisherId = process.env.NEXT_PUBLIC_MICHAELS_CJ_PUBLISHER_ID?.trim();
  const advertiserId = process.env.NEXT_PUBLIC_MICHAELS_CJ_ADVERTISER_ID?.trim() || MICHAELS_CJ_ADVERTISER_ID;

  if (!publisherId || !DIGITS_ONLY.test(publisherId) || !DIGITS_ONLY.test(advertiserId)) {
    return target.toString();
  }

  return `https://www.anrdoezrs.net/click-${publisherId}-${advertiserId}?url=${encodeURIComponent(target.toString())}`;
}

type ProductCategory = 'hook' | 'yarn' | 'book' | 'accessory';

interface AffiliateProduct {
  id: string;
  category: ProductCategory;
  name: string;
  description: string;
  amazonQuery: string;
  michaelsQuery: string | null;
}

const PRODUCTS: AffiliateProduct[] = [
  // ── Hooks ──────────────────────────────────────────────────────────────────
  {
    id: 'hook-ergonomic-set',
    category: 'hook',
    name: 'Ergonomic Crochet Hook Set',
    description: 'Soft-grip handles reduce hand fatigue on long projects.',
    amazonQuery: 'ergonomic crochet hook set soft grip',
    michaelsQuery: 'ergonomic crochet hook set',
  },
  {
    id: 'hook-tunisian',
    category: 'hook',
    name: 'Tunisian Crochet Hook Set',
    description: 'Long flexible hooks for Tunisian and entrelac work.',
    amazonQuery: 'tunisian crochet hook set flexible cable',
    michaelsQuery: 'tunisian crochet hook',
  },
  // ── Yarns ─────────────────────────────────────────────────────────────────
  {
    id: 'yarn-red-heart',
    category: 'yarn',
    name: 'Red Heart Super Saver Yarn',
    description: 'Colorfast worsted weight — ideal for tapestry blankets.',
    amazonQuery: 'Red Heart Super Saver yarn worsted weight skein',
    michaelsQuery: 'Red Heart Super Saver yarn',
  },
  {
    id: 'yarn-lion-brand',
    category: 'yarn',
    name: 'Lion Brand Pound of Love',
    description: 'Huge value skeins in soft, washable acrylic.',
    amazonQuery: 'Lion Brand Pound of Love yarn skein',
    michaelsQuery: 'Lion Brand Pound of Love yarn',
  },
  {
    id: 'yarn-caron',
    category: 'yarn',
    name: 'Caron Simply Soft Yarn',
    description: 'Smooth DK-weight acrylic with vibrant color range.',
    amazonQuery: 'Caron Simply Soft yarn skein',
    michaelsQuery: 'Caron Simply Soft yarn',
  },
  // ── Books ─────────────────────────────────────────────────────────────────
  {
    id: 'book-tapestry',
    category: 'book',
    name: 'Tapestry Crochet & More',
    description: 'Step-by-step guide to colorwork and tapestry techniques.',
    amazonQuery: 'tapestry crochet book colorwork patterns',
    michaelsQuery: null,
  },
  {
    id: 'book-complete-guide',
    category: 'book',
    name: 'Complete Photo Guide to Crochet',
    description: 'Visual reference for stitches, swatching, and finishing.',
    amazonQuery: 'complete photo guide crochet stitches reference book',
    michaelsQuery: null,
  },
  // ── Accessories ───────────────────────────────────────────────────────────
  {
    id: 'acc-stitch-markers',
    category: 'accessory',
    name: 'Locking Stitch Markers (100-pack)',
    description: 'Clip-on markers for tracking pattern rows and repeats.',
    amazonQuery: 'locking stitch markers crochet 100 pack',
    michaelsQuery: 'locking stitch markers crochet',
  },
  {
    id: 'acc-swift-winder',
    category: 'accessory',
    name: 'Yarn Swift & Ball Winder Set',
    description: 'Wind skeins into center-pull cakes in seconds.',
    amazonQuery: 'yarn swift ball winder set',
    michaelsQuery: 'yarn swift ball winder',
  },
  {
    id: 'acc-tapestry-needles',
    category: 'accessory',
    name: 'Large-Eye Tapestry Needles',
    description: 'Blunt needles for weaving in ends and seaming.',
    amazonQuery: 'large eye tapestry needles yarn weaving blunt',
    michaelsQuery: 'tapestry needles yarn blunt',
  },
  {
    id: 'acc-project-bag',
    category: 'accessory',
    name: 'Crochet Project Tote Bag',
    description: 'Keeps your WIP, hooks, and yarn neatly in one place.',
    amazonQuery: 'crochet knitting project tote bag organizer',
    michaelsQuery: 'craft project bag organizer',
  },
];

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  hook: 'Hook',
  yarn: 'Yarn',
  book: 'Book',
  accessory: 'Accessory',
};

const CATEGORY_COLORS: Record<ProductCategory, string> = {
  hook: 'bg-[rgba(200,102,60,0.12)] text-[color:var(--brand-primary)]',
  yarn: 'bg-[rgba(59,102,80,0.12)] text-[color:var(--brand-secondary)]',
  book: 'bg-[rgba(52,105,151,0.12)] text-[color:var(--accent-info)]',
  accessory: 'bg-[rgba(222,170,103,0.2)] text-[#7a5820]',
};

interface Props {
  /** Optionally filter by category. Omit to show all products. */
  filter?: ProductCategory | ProductCategory[];
  /** Section heading, defaults to "Shop Maker Supplies" */
  heading?: string;
}

export default function AffiliateAdStrip({ filter, heading = 'Shop Maker Supplies' }: Props) {
  const filters = filter ? (Array.isArray(filter) ? filter : [filter]) : null;
  const products = filters ? PRODUCTS.filter((p) => filters.includes(p.category)) : PRODUCTS;

  return (
    <aside aria-label={heading}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[color:var(--foreground)]">
            {heading}
          </h2>
          <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">
            Affiliate links support Crochet Canvas at no extra cost to you.
          </p>
        </div>
        <span className="rounded-full border border-[color:var(--border-soft)] bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
          Sponsored
        </span>
      </div>

      {/* Horizontal scroll on mobile, wrapping grid on larger screens */}
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <article
            key={product.id}
            className="flex min-w-[220px] shrink-0 flex-col rounded-2xl border border-[color:var(--border-soft)] bg-white/75 p-4 shadow-sm sm:min-w-0"
          >
            {/* Category badge */}
            <span
              className={`mb-3 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${CATEGORY_COLORS[product.category]}`}
            >
              {CATEGORY_LABELS[product.category]}
            </span>

            {/* Name + description */}
            <div className="flex-1">
              <p className="text-sm font-semibold leading-5 text-[color:var(--foreground)]">
                {product.name}
              </p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
                {product.description}
              </p>
            </div>

            {/* Affiliate buy buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={buildAmazonUrl(product.amazonQuery)}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded-xl bg-[rgba(200,102,60,0.10)] px-3 py-1.5 text-xs font-semibold text-[color:var(--brand-primary)] transition-colors hover:bg-[rgba(200,102,60,0.18)]"
              >
                Amazon ↗
              </a>
              {product.michaelsQuery && (
                <a
                  href={buildMichaelsUrl(product.michaelsQuery)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded-xl bg-[rgba(59,102,80,0.10)] px-3 py-1.5 text-xs font-semibold text-[color:var(--brand-secondary)] transition-colors hover:bg-[rgba(59,102,80,0.18)]"
                >
                  Michaels ↗
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
