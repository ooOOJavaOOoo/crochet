'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ShoppingListItem } from '@/lib/types';

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
      className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-purple-700">Tapestry Crochet</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-xl shadow-sm p-10 max-w-md w-full text-center">

          {/* Polling state */}
          {status === 'polling' && (
            <>
              <div className="flex justify-center mb-6">
                <Spinner />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Processing payment…</h2>
              <p className="text-gray-500 text-sm">
                Please wait while we confirm your purchase. This usually takes a few seconds.
              </p>
            </>
          )}

          {/* Complete state */}
          {status === 'complete' && downloadToken && (
            <>
              <div className="text-5xl mb-4" aria-hidden="true">🎉</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Your pattern is ready!</h2>
              <p className="text-gray-500 text-sm mb-8">
                Thank you for your purchase. Download your full PDF below.
              </p>
              <a
                href={`/api/download/${encodeURIComponent(downloadToken)}`}
                download
                className="inline-flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-xl font-bold text-lg transition-colors"
              >
                ⬇ Download Full PDF
              </a>
              <p className="text-xs text-gray-400 mt-4">
                Your download link is valid for 24 hours.
              </p>

              {shoppingList.length > 0 && (
                <div className="mt-8 rounded-lg border border-gray-200 p-4 text-left">
                  <h3 className="text-sm font-semibold text-gray-900">Amazon Shopping List</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Auto-built from your pattern materials so you can order everything quickly.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {shoppingList.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.title}</p>
                          <p className="text-xs text-gray-500">
                            Qty: {item.quantity} {item.unit}
                            {item.notes ? ` • ${item.notes}` : ''}
                          </p>
                        </div>
                        <a
                          href={item.amazonSearchUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-400"
                        >
                          View on Amazon
                        </a>
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
              <h2 className="text-xl font-bold text-gray-800 mb-2">Payment is still processing</h2>
              <p className="text-gray-500 text-sm mb-6">
                This is taking longer than expected. Your purchase is being processed — check back
                shortly or refresh this page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold text-sm transition-colors mb-3"
              >
                Refresh
              </button>
            </>
          )}

          {/* Error state */}
          {status === 'error' && (
            <>
              <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
              <p className="text-gray-500 text-sm mb-6">
                {errorMessage ?? 'An unexpected error occurred.'}
              </p>
            </>
          )}

          {/* Always show "Start over" link */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <Link
              href="/"
              className="text-sm text-purple-600 hover:text-purple-700 underline"
            >
              ← Start over
            </Link>
          </div>
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <span className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
