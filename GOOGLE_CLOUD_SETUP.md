# Google Cloud Setup Guide

This app uses **Google Vertex AI (Imagen)** for image generation in the `/api/image` endpoint. The error "Could not load the default credentials" means the app can't authenticate with Google Cloud.

## Quick Start for Local Development

### Option A: Use gcloud CLI (Recommended, Easiest)

```bash
# Install gcloud SDK if you haven't already:
# https://cloud.google.com/sdk/docs/install

# Authenticate with your Google account:
gcloud auth application-default login

# Select your GCP project:
gcloud config set project YOUR_PROJECT_ID
```

Then the app will automatically find credentials when it starts. No environment variables needed.

### Option B: Use Service Account JSON File

1. **Create a service account in Google Cloud Console:**
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
   - Click "Create Service Account"
   - Name: `crochet-app-dev` (or your preference)
   - Grant roles:
     - `Vertex AI Service Agent`
     - `Vertex AI User`
   - Click "Create and Continue"
   - Skip "Grant users access" (unless you want others to use the key)
   - Click "Done"

2. **Create and download a JSON key:**
   - On the service account page, go to the "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose "JSON"
   - Click "Create"
   - A JSON file will download automatically
   - **Keep this file secure — don't commit to git!**

3. **Add the path to `.env.local`:**
   ```dotenv
   GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```

   Example (Windows):
   ```dotenv
   GOOGLE_APPLICATION_CREDENTIALS="C:\\Users\\YourName\\Downloads\\crochet-app-dev-key.json"
   ```

   Example (Mac/Linux):
   ```dotenv
   GOOGLE_APPLICATION_CREDENTIALS="/Users/yourname/Downloads/crochet-app-dev-key.json"
   ```

4. **Set other required env vars:**
   ```dotenv
   GOOGLE_VERTEX_PROJECT="your-gcp-project-id"
   GOOGLE_VERTEX_LOCATION="us-central1"
   ```

   Find your project ID at: https://console.cloud.google.com/welcome

## Production Setup (Vercel)

1. **Create and download a service account JSON key** (use Option B steps 1-2 above)

2. **Copy the entire JSON contents**

3. **Add to Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Create a new variable:
     - Name: `GOOGLE_APPLICATION_CREDENTIALS_JSON`
     - Value: Paste the entire JSON file contents
     - Environments: Select all (Production, Preview, Development)

4. **Also add these variables:**
   - `GOOGLE_VERTEX_PROJECT`: Your GCP project ID
   - `GOOGLE_VERTEX_LOCATION`: `us-central1`

5. **Redeploy:** Push a commit or manually trigger a redeployment in Vercel

The app will automatically write the JSON to `/tmp/google-cloud-credentials.json` on startup and use it for authentication.

## Verify It's Working

Once credentials are set up, test with:

```bash
curl -X POST http://localhost:3000/api/image \
  -H "Content-Type: application/json" \
   -d '{"prompt": "a fox toy with chunky yarn details", "aspectRatio": "1:1", "stylePreset": "amigurumi-plush-3d"}'
```

Should return a base64-encoded image (not an error about credentials).

## Troubleshooting

| Error | Solution |
|-------|----------|
| `Could not load the default credentials` | Run `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS` env var |
| `Permission denied` or `Forbidden` | Ensure service account has `Vertex AI User` and `Vertex AI Service Agent` roles |
| `Project not found` | Check that `GOOGLE_VERTEX_PROJECT` matches your actual GCP project ID |
| `Location not supported` | Change `GOOGLE_VERTEX_LOCATION` to `us-central1` (currently only supported region for Imagen) |

## Learn More

- [Google Cloud Authentication Docs](https://cloud.google.com/docs/authentication/application-default-credentials)
- [Vertex AI Generative AI Services](https://cloud.google.com/vertex-ai/docs/generative-ai/overview)
- [Imagen on Vertex AI](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)
