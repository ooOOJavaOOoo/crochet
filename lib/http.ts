export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const pairs = cookieHeader.split(';');
  const result: Record<string, string> = {};

  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split('=');
    if (!rawKey || rest.length === 0) {
      continue;
    }

    const key = rawKey.trim();
    const value = rest.join('=').trim();
    result[key] = decodeURIComponent(value);
  }

  return result;
}

export function buildSetCookie(name: string, value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

export function buildClearCookie(name: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}
