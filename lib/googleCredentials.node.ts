import 'server-only';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Ensure Google Cloud credentials can be discovered by SDKs that require
 * GOOGLE_APPLICATION_CREDENTIALS as a file path.
 */
export function ensureGoogleCredentialsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return;
  }

  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!json) {
    return;
  }

  try {
    const credentialsPath = path.join('/tmp', 'google-cloud-credentials.json');
    fs.writeFileSync(credentialsPath, json);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  } catch (error) {
    console.error('Failed to write Google Cloud credentials to temp file:', error);
  }
}
