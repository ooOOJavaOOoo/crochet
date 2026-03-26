'use client';

import Link from 'next/link';
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[PageErrorBoundary] Unhandled UI exception', { error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
          <main className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h1 className="text-2xl font-bold">Something went wrong</h1>
              <p className="mt-3 text-sm text-slate-600">
                The page hit an unexpected error. You can refresh or start a new pattern.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Refresh page
                </button>
                <Link
                  href="/"
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Start over
                </Link>
              </div>
            </div>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}
