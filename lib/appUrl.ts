const APP_URL_ALLOWLIST = (process.env.APP_URL_ALLOWLIST ?? '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

function firstForwardedValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const first = value.split(',')[0]?.trim();
  return first || null;
}

function normalizeBaseUrl(value: string): string {
  return new URL(value).toString().replace(/\/$/, '');
}

export function getRequiredAppUrl(): string {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('APP_URL (or NEXT_PUBLIC_APP_URL) is required');
  }

  const normalized = normalizeBaseUrl(appUrl);
  if (APP_URL_ALLOWLIST.length === 0) {
    return normalized;
  }

  const allowed = APP_URL_ALLOWLIST.some((candidate) => {
    try {
      return normalizeBaseUrl(candidate) === normalized;
    } catch {
      return false;
    }
  });

  if (!allowed) {
    throw new Error('Configured APP_URL is not in APP_URL_ALLOWLIST');
  }

  return normalized;
}

export function getAppUrlFromRequest(request: Request): string | null {
  const host =
    firstForwardedValue(request.headers.get('x-forwarded-host'))
    ?? request.headers.get('host')?.trim()
    ?? null;

  if (!host) {
    return null;
  }

  const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto'));
  const protocol = forwardedProto ?? (host.startsWith('localhost') ? 'http' : 'https');

  try {
    return normalizeBaseUrl(`${protocol}://${host}`);
  } catch {
    return null;
  }
}
