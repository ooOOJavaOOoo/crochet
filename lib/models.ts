// Model identifiers — verify these against the current Google AI model list before deploying:
// Text/multimodal: https://ai.google.dev/gemini-api/docs/models
// Image generation: https://ai.google.dev/gemini-api/docs/imagen
export const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';
export const IMAGEN_FAST_MODEL = 'imagen-4.0-fast-generate-001';

// Vertex AI defaults for Imagen image generation/editing.
export const VERTEX_DEFAULT_LOCATION = 'us-central1';

export function getGoogleApiKey() {
  return process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}

export function getGoogleVertexProject() {
  return process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
}

export function getGoogleVertexLocation() {
  return process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || VERTEX_DEFAULT_LOCATION;
}