import * as fs from 'fs';
import * as path from 'path';

// Model identifiers — verify these against the current Google AI model list before deploying:
// Text/multimodal: https://ai.google.dev/gemini-api/docs/models
// Image generation: https://ai.google.dev/gemini-api/docs/imagen
export const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';
export const IMAGEN_FAST_MODEL = 'imagen-4.0-fast-generate-001';

// Vertex AI defaults for Imagen image generation/editing.
export const VERTEX_DEFAULT_LOCATION = 'us-central1';

/**
 * Initialize Google Cloud credentials from environment.
 * Handles both local development and production (Vercel) scenarios.
 * 
 * Local: Set GOOGLE_APPLICATION_CREDENTIALS to path of service account JSON
 * Production: Set GOOGLE_APPLICATION_CREDENTIALS_JSON to full JSON string
 */
function initializeGoogleCredentials() {
  // If JSON credentials are provided as string (Vercel), write to temp file
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const credentialsPath = path.join('/tmp', 'google-cloud-credentials.json');
      fs.writeFileSync(credentialsPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    } catch (error) {
      console.error('Failed to write Google Cloud credentials to temp file:', error);
    }
  }
}

// Initialize on module load
initializeGoogleCredentials();

export function getGoogleApiKey() {
  return process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}

export function getGoogleVertexProject() {
  return process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
}

export function getGoogleVertexLocation() {
  return process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || VERTEX_DEFAULT_LOCATION;
}