import { Env } from '@env';

export function resolveMediaUrl(url: string): string {
  const domain = Env.API_URL?.replace('/api', '') ?? '';
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url.replace(`${Env.API_URL}/api/`, `${Env.API_URL}/`);
  }
  if (!Env.API_URL) return url;
  // Some backends return media paths under `/api/...` even though static files
  // are served from the root. Normalize by stripping `/api` for media loading.
  if (url.startsWith('/api/')) return `${domain}${url.replace('/api/', '/')}`;
  if (url.startsWith('/')) return `${domain}${url}`;
  return `${Env.API_URL}/${url}`;
}
