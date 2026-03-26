// Model identifiers — verify these against the current Google AI model list before deploying:
// Text/multimodal: https://ai.google.dev/gemini-api/docs/models
// Image generation: https://ai.google.dev/gemini-api/docs/imagen
export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';
export const IMAGEN_FAST_MODEL = 'imagen-4.0-fast-generate-001';

export function getGoogleApiKey() {
  return process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}