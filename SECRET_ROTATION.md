# Secret Rotation Runbook

Use this document any time a secret is leaked, compromised, or needs rotation as part of a scheduled security review.

---

## Immediate Response Checklist

When a leak is suspected or confirmed:

1. **Identify** which key(s) were exposed (see sections below)
2. **Revoke** the compromised key at the provider — do this first, before generating a replacement
3. **Generate** a new key/secret
4. **Deploy** the new value to all environments (local, staging, production)
5. **Verify** the app is functioning normally after rotation
6. **Audit** access logs at the provider to check for unauthorized use during the exposure window
7. **Document** the incident: what was exposed, when, how, and what was done

---

## Keys & Rotation Procedures

### 1. Google Generative AI API Key
**Env vars:** `GOOGLE_GENERATIVE_AI_API_KEY`, `GOOGLE_API_KEY`
**Used by:** `/api/generate`, `/api/chat`, `/api/pattern`, `/api/recommend`

**Steps:**
1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Delete or revoke the compromised key
3. Click **Create API key** → select the `crochet-490613` project
4. Copy the new key
5. Update `.env.local` (both `GOOGLE_GENERATIVE_AI_API_KEY` and `GOOGLE_API_KEY`)
6. Update in Vercel Dashboard → Project Settings → Environment Variables for all environments
7. Redeploy

**Check for abuse:** Google Cloud Console → APIs & Services → Credentials → check usage graphs

---

### 2. Google Service Account Credentials (Vertex AI / Imagen)
**Env vars:** `GOOGLE_APPLICATION_CREDENTIALS` (local), `GOOGLE_APPLICATION_CREDENTIALS_JSON` (production)
**Used by:** `/api/image` (Vertex AI Imagen)

**Steps:**
1. Go to [Google Cloud Console → IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Find the service account for this project
3. Click the account → **Keys** tab → delete the compromised key
4. Click **Add Key → Create new key → JSON** → download
5. For local: replace the `.json` file at the path in `GOOGLE_APPLICATION_CREDENTIALS`
6. For production: base64-encode or inline the JSON and update `GOOGLE_APPLICATION_CREDENTIALS_JSON` in Vercel
7. Redeploy

**Check for abuse:** Cloud Console → Logging → filter by service account email

---

### 3. Stripe Secret Key
**Env var:** `STRIPE_SECRET_KEY`
**Used by:** `/api/checkout`, `/api/checkout/status`

**Steps:**
1. Go to [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
2. Click **Roll key** next to the compromised secret key (this immediately invalidates the old key)
3. Copy the new key
4. Update `.env.local`
5. Update in Vercel Dashboard → Environment Variables
6. Redeploy

**Check for abuse:** Stripe Dashboard → Events → filter for unexpected charges or API calls

---

### 4. Stripe Publishable Key
**Env var:** `STRIPE_PUBLISHABLE_KEY`
**Used by:** Client-side Stripe.js initialization

**Steps:**
1. Go to [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
2. Roll the publishable key
3. Update `.env.local` and Vercel Environment Variables
4. Redeploy

> Note: The publishable key is client-side and has limited risk on its own, but rotate it if the secret key was also exposed.

---

### 5. Stripe Webhook Secret
**Env var:** `STRIPE_WEBHOOK_SECRET`
**Used by:** `/api/webhooks/stripe`

**Steps:**
1. Go to [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Select the compromised webhook endpoint
3. Click **Roll secret** (under the Signing Secret section)
4. Copy the new `whsec_...` value
5. Update `.env.local` and Vercel Environment Variables
6. Redeploy

> Each environment (local, staging, production) has its own webhook endpoint and signing secret.

---

### 6. JWT Secret
**Env var:** `JWT_SECRET`
**Used by:** `/api/download/[token]` — signs and verifies single-use download tokens

**Steps:**
1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Update `.env.local` and Vercel Environment Variables
3. Redeploy

> **Side effect:** All existing download tokens signed with the old secret will be immediately invalidated. Any customers with outstanding download links (valid for 24 hrs) will need new links. Contact support or re-trigger the post-payment email manually if needed.

---

### 7. Resend API Key
**Env var:** `RESEND_API_KEY`
**Used by:** Post-payment download link emails

**Steps:**
1. Go to [https://resend.com/api-keys](https://resend.com/api-keys)
2. Delete the compromised key
3. Click **Create API Key** → choose appropriate permissions (Sending access)
4. Copy the new key
5. Update `.env.local` and Vercel Environment Variables
6. Redeploy

**Check for abuse:** Resend Dashboard → Logs → look for unauthorized sends or unusual volume

---

### 8. Vercel Blob Token
**Env var:** `BLOB_READ_WRITE_TOKEN`
**Used by:** PDF upload and storage

**Steps:**
1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard) → Storage → your Blob store
2. Navigate to **Settings** → delete the compromised token
3. Generate a new token
4. Update `.env.local` and Vercel Environment Variables
5. Redeploy

> Stored PDFs are not deleted when the token is rotated — only access is revoked.

---

### 9. Vercel KV Tokens (Upstash Redis)
**Env vars:** `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `KV_REST_API_URL`
**Used by:** Rate limiting, session tokens, pattern storage

**Steps:**
1. Go to Vercel Dashboard → Storage → your KV store → **Settings**
2. Rotate or regenerate the REST API token
3. Vercel auto-updates the linked environment variables on redeploy, or update manually
4. Redeploy

---

### 10. Cron Secret
**Env var:** `CRON_SECRET`
**Used by:** `/api/cron/cleanup-blobs` — authenticates Vercel cron job requests

**Steps:**
1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Update `.env.local`
3. Update in Vercel Dashboard → Environment Variables (must match what Vercel sends in the cron header)
4. Update `vercel.json` if the cron header value is hardcoded there
5. Redeploy

---

## Vercel Environment Variables Reference

All secrets must be set in **Vercel Dashboard → Project → Settings → Environment Variables** for each environment:

| Environment | Usage |
|-------------|-------|
| Production | Live site |
| Preview | PR/branch deployments |
| Development | `vercel env pull` to local |

After updating any variable, **trigger a redeploy** for it to take effect.

---

## Rotation Schedule (Recommended)

| Cadence | Keys |
|---------|------|
| Immediately on any suspected exposure | All of them |
| Every 90 days | `JWT_SECRET`, `CRON_SECRET` |
| Annually or on team change | Stripe keys, Google API keys, Resend key |
| On each new deployment environment | `STRIPE_WEBHOOK_SECRET` (unique per endpoint) |
