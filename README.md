# Crochet Canvas

Crochet Canvas is a webapp that converts images into tapestry crochet patterns using Google Gemini AI and Vertex AI Imagen.

## Features

- Upload an image
- Specify grid size, color limitations, yarn brand, and exact yarn colors (when using exact color mode; e.g., "Red Heart Super Saver, Cherry Red")
- Generate crochet pattern with AI
- Generate 3D amigurumi-style stuffed toy-animal concept images via `POST /api/image` (`stylePreset: "amigurumi-plush-3d"`)
- Preview the pattern
- Export as PDF

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in every value
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

### Environment variables

See `.env.local.example` for a full list. At minimum you need:

| Variable | Description |
|----------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API key (from [Google AI Studio](https://aistudio.google.com/)) |
| `GOOGLE_VERTEX_PROJECT` | Google Cloud project ID used for Vertex AI image generation/editing |
| `GOOGLE_VERTEX_LOCATION` | Vertex AI region for Imagen models (default in code: `us-central1`) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `JWT_SECRET` | Random 256-bit secret for one-time download tokens |
| `CRON_SECRET` | Bearer token that authorises the cleanup cron job |
| `APP_URL` | Canonical public app URL used for Stripe redirects and email links (required in production) |
| `APP_URL_ALLOWLIST` | Optional comma-separated allowlist of acceptable APP_URL values |
| `NEXT_PUBLIC_APP_URL` | Publicly reachable base URL, e.g. `https://yourapp.vercel.app` |
| `AMAZON_ASSOCIATE_TAG` | Amazon Associates tracking ID used in all shopping links, e.g. `yourstore-20` |
| `KV_REST_API_URL` | Vercel KV REST endpoint |
| `KV_REST_API_TOKEN` | Vercel KV REST token |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token |
| `BLOB_HOST_ALLOWLIST` | Optional comma-separated blob host allowlist for secure downloads (default: `blob.vercel-storage.com`) |

### Vercel deployment

1. Push to GitHub and connect the repo to Vercel.
2. Enable the **Vercel KV** and **Vercel Blob** add-ons in the Vercel dashboard.
3. In Vercel → Settings → Environment Variables, add every variable listed in `.env.local.example`.
4. In the Stripe dashboard, create a webhook pointing to `https://<your-domain>/api/webhooks/stripe` for the `checkout.session.completed` event. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
5. Build command: `npm run build` · Output directory: `.next`.

## Usage

1. Upload an image
2. Fill in the details
3. Click "Generate Pattern"
4. View the preview
5. Export as PDF if desired

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
