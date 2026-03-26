# Project TODO — Tapestry Crochet Pattern Generator

A tracked checklist of everything needed to take this app from current state to production launch.
Items are ordered by phase and priority. Complete Phase 1 before moving on.

---

## Phase 1 — Critical Fixes (Blockers)

These must be resolved before the app will work correctly in production.

- [x] **Fix `vercel.json` syntax error** — The `functions` object is closed prematurely after `tokens/route.ts`; `pattern`, `preview`, `checkout`, `webhooks/stripe`, and `download` routes all fall outside the object, so their `maxDuration` values are silently ignored. Merge all entries into a single valid `functions` block.
- [x] **Fix README env-var documentation** — README currently lists `GOOGLE_PROJECT_ID`, `GOOGLE_AI_ENDPOINT_ID`, and `GOOGLE_LOCATION` (Vertex AI — not used in the code). Replace with the actual required variables (see `.env.local.example` task below).
- [x] **Create `.env.local.example`** — Document every environment variable the app needs:
  - `GOOGLE_GENERATIVE_AI_API_KEY` — Google Gemini API key
  - `STRIPE_SECRET_KEY` — Stripe secret key
  - `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
  - `JWT_SECRET` — HS256 secret for one-time download tokens (min 32 chars, random)
  - `CRON_SECRET` — Bearer token for cron job authorization
  - `NEXT_PUBLIC_APP_URL` — Public base URL (e.g. `https://yourdomain.com`)
  - `KV_REST_API_URL` — Vercel KV REST endpoint
  - `KV_REST_API_TOKEN` — Vercel KV REST token
  - `BLOB_READ_WRITE_TOKEN` — Vercel Blob read/write token
- [x] **Verify AI model names are valid** — `lib/models.ts` uses `"gemini-3-flash-preview"` and `"imagen-4.0-fast-generate-001"`. Confirm these are current identifiers in the Google AI API; update if they have changed.

---

## Phase 2 — Missing Features

Core features that are partially wired or installed but not yet implemented.

- [x] **Implement rate limiting** — `@upstash/ratelimit` is already installed but unused. Add rate limiting to the three most expensive endpoints: `POST /api/pattern`, `POST /api/image`, and `POST /api/recommend`. Use sliding-window limits (e.g. 10 requests/min per IP). Return `429 Too Many Requests` with a `Retry-After` header.
- [ ] **Wire up or remove `/api/chat`** — The streaming chat route exists but the main UI (`app/page.tsx`) does not appear to call it. Either integrate it into the UI as an assistant/help panel, or remove it and its `maxDuration` entry in `vercel.json` to reduce dead code.
- [x] **Remove or clearly deprecate `/api/generate`** — This is the legacy Gemini text route that predates the quantized pattern pipeline. It should either be removed or clearly marked `@deprecated` in code and excluded from `vercel.json`.
- [x] **Complete exact yarn color mode UI** — The backend fully supports brand-constrained color snapping, but confirm the `brandId` dropdown and any "exact color" text field in `app/page.tsx` are fully wired to the `POST /api/pattern` request body.
- [x] **Fix token cost estimation** — `app/api/tokens/route.ts` uses a placeholder price of `$0.000001/token`. Replace with the actual Gemini Flash pricing from the Google AI pricing page, or remove the endpoint if it is not surfaced in the UI.

---

## Phase 3 — Quality & Hardening

Improve reliability and user experience.

- [ ] **Add download failure recovery UI** — If the blob fetch fails in `GET /api/download/[token]`, the token is un-marked but the user sees a generic error. Show a retry button on the success page so users can attempt the download again without repurchasing.
- [ ] **Add client-side aspect ratio helper** — `app/page.tsx` calls `getImageAspectRatio()` which is not defined in any file. Implement this utility (reads `Image.naturalWidth / naturalHeight` after load) or confirm it already exists elsewhere.
- [ ] **Expand yarn color database** — Only ~95 colors across 4 brands are currently included in `lib/yarn.ts`. Consider adding more colorways (especially Lion Brand Pound of Love, Bernat Blanket) to improve yarn match quality.
- [ ] **Improve PDF layout** — Review the generated PDF on both desktop and mobile PDF viewers. Check that the stitch chart (SVG → PNG via Resvg) renders crisply at full blanket sizes (e.g. 432 columns King size), and that row instruction pages wrap correctly.
- [ ] **Error boundary in UI** — Wrap the main page state machine in a React error boundary so an unhandled exception during generation/preview doesn't leave users on a blank screen.
- [ ] **Accessibility pass** — Audit the main page form controls (image upload, grid sliders, preset buttons) for keyboard navigation, ARIA labels, and color contrast against Tailwind defaults.

---

## Phase 4 — Security Review

Must complete before accepting real payments.

- [ ] **Stripe webhook signature always verified** — Confirm `verifyWebhookSignature` is called before any business logic in `app/api/webhooks/stripe/route.ts`. (Already present — verify no early-return path bypasses it.)
- [ ] **`JWT_SECRET` strength** — Ensure production `JWT_SECRET` is at least 256 bits of entropy. Add a startup check or documentation warning.
- [ ] **`CRON_SECRET` authorization** — Verify the cleanup cron route rejects all requests without a valid `Authorization: Bearer <CRON_SECRET>` header. (Already present — confirm it fails closed, not open.)
- [ ] **Input validation coverage** — Zod schemas exist for pattern and checkout. Confirm image upload in `/api/image` validates file size (≤10 MB) and MIME type server-side, not just client-side.
- [ ] **No secrets in client bundle** — Audit that no `STRIPE_SECRET_KEY`, `JWT_SECRET`, or other server-only env vars are referenced outside `app/api/` or `lib/` (i.e., not in any client component).
- [ ] **Blob URLs are not guessable** — Verify Vercel Blob upload uses a unique path (e.g. `patterns/{patternId}.pdf`) so URLs cannot be enumerated without a valid download token.

---

## Phase 5 — Launch Readiness & Deployment

Final steps before opening to users.

- [ ] **Set up Vercel project** — Connect repo to Vercel, add all env vars from `.env.local.example`, enable Vercel KV and Vercel Blob add-ons.
- [ ] **Configure Stripe webhook** — Register `https://<your-domain>/api/webhooks/stripe` in the Stripe dashboard for the `checkout.session.completed` event. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
- [ ] **Test full purchase flow end-to-end** — Upload image → generate pattern → preview → checkout (Stripe test mode) → success page poll → PDF download → verify token is one-time-use.
- [ ] **Test cron job** — Manually `POST /api/cron/cleanup-blobs` with the correct `Authorization` header; verify old blobs are deleted and recent ones are preserved.
- [ ] **Set `NEXT_PUBLIC_APP_URL` correctly** — Stripe success/cancel URLs rely on this. Verify it matches the deployed domain exactly (no trailing slash).
- [ ] **Add basic monitoring** — Configure Vercel's built-in function logs and alerts, or add Sentry error tracking to catch runtime failures in the pattern generation and PDF pipelines.
- [ ] **Update README** — Replace the placeholder Vercel deployment instructions with accurate steps matching the actual env vars, Stripe configuration, and Vercel add-on setup.

---

## Backlog (Post-Launch)

Nice-to-haves for a future iteration.

- [ ] User accounts / pattern history (save and re-download past purchases)
- [ ] Promo / coupon code support via Stripe
- [ ] Support for additional yarn brands in `lib/yarn.ts`
- [ ] A/B test prompt variants for better color naming and size recommendations
- [ ] Analytics dashboard (purchases, patterns generated, conversion rate)
- [ ] Mobile-optimized image capture (camera input on `<input type="file">`)
- [ ] Stitch chart zoom / pan on the preview SVG
- [ ] Multi-page stitch chart split for very wide blankets
- [ ] Internationalisation (metric dimensions, non-USD currency)

---

## Progress Summary

| Phase | Total | Done |
|-------|-------|------|
| Phase 1 — Critical Fixes | 4 | 4 |
| Phase 2 — Missing Features | 5 | 0 |
| Phase 3 — Quality & Hardening | 6 | 0 |
| Phase 4 — Security Review | 6 | 0 |
| Phase 5 — Launch Readiness | 7 | 0 |
| **Total** | **28** | **0** |
