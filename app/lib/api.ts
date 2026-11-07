const configuredApiOrigin = process.env.NEXT_PUBLIC_API_URL?.trim();

export const apiOrigin = (configuredApiOrigin || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000'))
  .replace(/\/+$/, '');

export const publicApi = `${apiOrigin}/api/public`;
export const adminApi = `${apiOrigin}/api/admin`;
export const authApi = `${apiOrigin}/api/auth`;
