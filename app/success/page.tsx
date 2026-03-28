'use client';

import Image from 'next/image';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ShoppingListItem } from '@/lib/types';
import AffiliateAdStrip from '@/app/components/AffiliateAdStrip';

// ─── Types ────────────────────────────────────────────────────────────────────

type PollStatus = 'polling' | 'complete' | 'timeout' | 'error';

interface CheckoutStatusPayload {
  status: 'pending' | 'complete' | 'expired';
  downloadToken: string | null;
  shoppingList?: ShoppingListItem[] | null;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span
      className="h-12 w-12 animate-spin rounded-full border-4 border-[color:var(--border-soft)] border-t-[color:var(--brand-primary)]"
      aria-hidden="true"
    />
  );
}

// ─── Success content (needs Suspense for useSearchParams) ─────────────────────

function SuccessContent() {
  const [status, setStatus] = useState<PollStatus>('polling');
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setErrorMessage('No session ID found. Please contact support if you completed a purchase.');
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 30;

    const poll = async () => {
      if (cancelled) return;

      if (attempts >= MAX_ATTEMPTS) {
        if (!cancelled) setStatus('timeout');
        return;
      }

      attempts += 1;

      try {
        const res = await fetch(
          `/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`,
        );

        if (!res.ok) {
          if (res.status === 404) {
            setStatus('error');
            setErrorMessage('Checkout session was not found. Please try the payment flow again.');
            return;
          }

          if (res.status >= 500) {
            setStatus('error');
            setErrorMessage('Server error while confirming payment. Please refresh in a moment.');
            return;
          }

          // Treat other non-OK responses as transient.
          if (!cancelled) {
            pollTimer = setTimeout(poll, 2000);
          }
          return;
        }

        const data = (await res.json()) as CheckoutStatusPayload;

        if (cancelled) return;

        if (data.status === 'complete' && data.downloadToken) {
          setDownloadToken(data.downloadToken);
          setShoppingList(Array.isArray(data.shoppingList) ? data.shoppingList : []);
          setStatus('complete');
        } else if (data.status === 'expired') {
          setStatus('error');
          setErrorMessage('Your checkout session has expired. Please complete the purchase again.');
        } else {
          // Pending — poll again in 2 s
          pollTimer = setTimeout(poll, 2000);
        }
      } catch {
        // Network error — keep polling
        if (!cancelled) {
          pollTimer = setTimeout(poll, 2000);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [sessionId]);

  // ── Download handler (direct navigation is more reliable on mobile browsers) ──

  const handleDownload = async () => {
    if (!downloadToken || isDownloading) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const downloadPath = `/api/download/${encodeURIComponent(downloadToken)}`;

      // Use direct navigation so mobile browsers/WebViews can handle file downloads natively.
      const popup = window.open(downloadPath, '_blank', 'noopener,noreferrer');
      if (!popup) {
        window.location.assign(downloadPath);
      }
    } catch {
      setDownloadError('Download failed. Please try again.');
    } finally {
      setTimeout(() => setIsDownloading(false), 1000);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="crochet-page min-h-screen text-[color:var(--foreground)]">
      <header className="border-b border-[color:var(--border-soft)] bg-white/70 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-center sm:justify-start">
          <Image
            src="/crochet-canvas-logo.svg"
            alt="Crochet Canvas"
            width={270}
            height={80}
            className="h-12 w-auto"
            priority
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-start px-4 py-10 sm:py-14">
        <div className="crochet-card w-full max-w-lg rounded-[1.75rem] p-8 text-center sm:p-10">

          {/* Polling state */}
          {status === 'polling' && (
            <>
              <div className="flex justify-center mb-6">
                <Spinner />
              </div>
              <h2 className="mb-2 font-display text-3xl font-semibold text-[color:var(--foreground)]">Processing payment...</h2>
              <p className="text-sm text-[color:var(--text-secondary)]">
                Please wait while we confirm your purchase. This usually takes a few seconds.
              </p>
            </>
          )}

          {/* Complete state */}
          {status === 'complete' && downloadToken && (
            <>
              <div className="text-5xl mb-4" aria-hidden="true">🎉</div>
              <h2 className="mb-2 font-display text-3xl font-semibold text-[color:var(--foreground)]">Your pattern is ready!</h2>
              <p className="mb-8 text-sm text-[color:var(--text-secondary)]">
                Thank you for your purchase. Download your full PDF below.
              </p>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="success-button inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDownloading ? 'Downloading…' : '⬇ Download Full PDF'}
              </button>
              {downloadError && (
                <p className="mt-3 text-sm text-[#9f3a2a]">{downloadError}</p>
              )}
              <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
                If the download does not start automatically, tap
                {' '}
                <a
                  href={`/api/download/${encodeURIComponent(downloadToken)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[color:var(--brand-primary)] underline"
                >
                  open download link
                </a>
                .
              </p>
              <p className="mt-4 text-xs text-[color:var(--text-secondary)]">
                Your download link is valid for 24 hours.
              </p>

              {shoppingList.length > 0 && (
                <div className="mt-8 rounded-2xl border border-[color:var(--border-soft)] bg-white/70 p-4 text-left">
                  <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Shopping Links</h3>
                  <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                    Auto-built from your pattern materials so you can order everything quickly.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {shoppingList.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-[color:var(--border-soft)]/60 bg-[color:var(--surface-subtle)]/55 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-[color:var(--foreground)]">{item.title}</p>
                          <p className="text-xs text-[color:var(--text-secondary)]">
                            Qty: {item.quantity} {item.unit}
                            {item.notes ? ` • ${item.notes}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                          <a
                            href={item.amazonSearchUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-[color:var(--border-soft)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand-primary)] hover:bg-[color:var(--surface-subtle)]"
                          >
                            Amazon
                          </a>
                          {item.michaelsSearchUrl && (
                            <a
                              href={item.michaelsSearchUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-[color:var(--border-soft)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand-primary)] hover:bg-[color:var(--surface-subtle)]"
                            >
                              Michaels
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Timeout state */}
          {status === 'timeout' && (
            <>
              <div className="text-4xl mb-4" aria-hidden="true">⏳</div>
              <h2 className="mb-2 font-display text-2xl font-semibold text-[color:var(--foreground)]">Payment is still processing</h2>
              <p className="mb-6 text-sm text-[color:var(--text-secondary)]">
                This is taking longer than expected. Your purchase is being processed. Check back
                shortly or refresh this page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="primary-button mb-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                Refresh
              </button>
            </>
          )}

          {/* Error state */}
          {status === 'error' && (
            <>
              <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
              <h2 className="mb-2 font-display text-2xl font-semibold text-[color:var(--foreground)]">Something went wrong</h2>
              <p className="mb-6 text-sm text-[color:var(--text-secondary)]">
                {errorMessage ?? 'An unexpected error occurred.'}
              </p>
            </>
          )}

          {/* Always show "Start over" link */}
          <div className="mt-6 border-t border-[color:var(--border-soft)] pt-6">
            <Link
              href="/"
              className="text-sm font-semibold text-[color:var(--brand-primary)] underline hover:text-[color:var(--brand-primary-hover)]"
            >
              Back to Crochet Canvas
            </Link>
          </div>
        </div>

        {/* Affiliate recommendations — shown to all visitors once the page loads */}
        <div className="mt-8 w-full max-w-3xl rounded-[1.75rem] border border-[color:var(--border-soft)] bg-white/60 p-6">
          <AffiliateAdStrip heading="Complete Your Craft Supply Kit" />
        </div>
      </main>
    </div>
  );
}

// ─── Page export (Suspense required for useSearchParams in App Router) ─────────

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="crochet-page flex min-h-screen items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-[color:var(--border-soft)] border-t-[color:var(--brand-primary)]" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
