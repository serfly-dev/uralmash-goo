const apiOrigin = (process.env.API_INTERNAL_URL || `http://localhost:${process.env.API_PORT || 4000}`).replace(/\/+$/, '');
const API_TIMEOUT_MS = 5000;

export async function getServerPublicData<T>(path: string): Promise<{ status: number; data: T | null }> {
  try {
    const response = await fetch(`${apiOrigin}/api/public${path}`, { cache: 'no-store', signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (!response.ok) return { status: response.status, data: null };
    try {
      return { status: response.status, data: await response.json() as T };
    } catch {
      return { status: 502, data: null };
    }
  } catch (error) {
    return { status: error instanceof Error && error.name === 'TimeoutError' ? 504 : 503, data: null };
  }
}

export function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_ORIGIN;
  if (!value) {
    if (process.env.NODE_ENV === 'production') throw new Error('Set NEXT_PUBLIC_SITE_URL or APP_ORIGIN to the public HTTPS site origin.');
    return null;
  }
  try {
    const url = new URL(value);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (url.protocol === 'https:' && !isLocalhost) return url.origin;
    if (process.env.NODE_ENV !== 'production' && isLocalhost && (url.protocol === 'http:' || url.protocol === 'https:')) return url.origin;
  } catch {
    // Report invalid production configuration below.
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Production site origin must be a public HTTPS URL, not localhost.');
  return null;
}

export function assertPublicDataAvailable(result: { status: number; data: unknown }, label: string) {
  if (result.status !== 200 || result.data === null) {
    throw new Error(`Unable to load public ${label} data (HTTP ${result.status}).`);
  }
}
