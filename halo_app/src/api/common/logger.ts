/**
 * Verbose, security-safe logger for the axios client.
 *
 * Logs full URL + request body + response body + headers. Secrets are masked
 * (password / token / authorization) before printing.
 *
 * Set `ENABLED = false` in this file if logs become too noisy.
 */

const ENABLED = true;

export function maskToken(value?: string | null): string {
  if (!value) return '';
  const m = value.match(/^(Bearer\s+)?(.+)$/i);
  if (!m) return value;
  const prefix = m[1] ?? '';
  const tok = m[2];
  if (tok.length <= 8) return `${prefix}***`;
  return `${prefix}${tok.slice(0, 4)}…${tok.slice(-4)}`;
}

function fullUrl(baseURL: string | undefined, url: string | undefined): string {
  if (!url) return baseURL ?? '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseURL ?? ''}${url}`;
}

const MAX_DEPTH = 8;

function pretty(value: unknown): string {
  // Normalize first (handles Mongoose-like toJSON + drops symbols)
  let normalized: unknown;
  try {
    normalized = JSON.parse(JSON.stringify(value));
  } catch {
    normalized = value;
  }
  try {
    return JSON.stringify(
      sanitize(normalized, new WeakSet(), 0),
      null,
      2
    );
  } catch (e: any) {
    return `[unloggable: ${e?.message ?? 'unknown'}]`;
  }
}

export function logRequest(config: {
  method?: string;
  baseURL?: string;
  url?: string;
  params?: unknown;
  data?: unknown;
  headers?: Record<string, unknown>;
}) {
  if (!ENABLED) return;
  const url = fullUrl(config.baseURL, config.url);
  // eslint-disable-next-line no-console
  console.log(`[API] → ${(config.method ?? '').toUpperCase()} ${url}`);
  if (config.params && Object.keys(config.params as object).length > 0) {
    // eslint-disable-next-line no-console
    console.log('[API]   params:', pretty(config.params));
  }
  if (config.data != null) {
    // eslint-disable-next-line no-console
    console.log('[API]   body:', pretty(config.data));
  }
  if (config.headers) {
    // eslint-disable-next-line no-console
    console.log('[API]   headers:', pretty(config.headers));
  }
}

export function logResponse(
  config: { method?: string; baseURL?: string; url?: string },
  status: number,
  durationMs: number,
  data: unknown
) {
  if (!ENABLED) return;
  const url = fullUrl(config.baseURL, config.url);
  // eslint-disable-next-line no-console
  console.log(
    `[API] ← ${(config.method ?? '').toUpperCase()} ${url} ${status} ${durationMs.toFixed(0)}ms`
  );
  if (data != null) {
    // eslint-disable-next-line no-console
    console.log('[API]   data:', pretty(data));
  }
}

export function logError(
  config: { method?: string; baseURL?: string; url?: string } | undefined,
  status: number | undefined,
  durationMs: number,
  message: string | undefined,
  data?: unknown
) {
  if (!ENABLED) return;
  const url = fullUrl(config?.baseURL, config?.url);
  const tag = status ? String(status) : 'ERR';
  // eslint-disable-next-line no-console
  console.warn(
    `[API] ✗ ${(config?.method ?? '').toUpperCase()} ${url} ${tag} ${durationMs.toFixed(0)}ms${
      message ? ` message="${message}"` : ''
    }`
  );
  if (data != null) {
    // eslint-disable-next-line no-console
    console.warn('[API]   data:', pretty(data));
  }
}

/**
 * Best-effort sanitizer: strips/masks secret-looking fields before logging.
 * Robust against circular references (WeakSet of ancestors) and deep graphs.
 */
function sanitize(
  value: unknown,
  ancestors: WeakSet<object>,
  depth: number
): unknown {
  if (depth > MAX_DEPTH) return '[depth limit]';
  if (value == null || typeof value !== 'object') return value;
  if (ancestors.has(value as object)) return '[circular]';
  ancestors.add(value as object);
  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map((v) => sanitize(v, ancestors, depth + 1));
  } else {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (
        lower === 'password' ||
        lower === 'passcode' ||
        lower === 'pin' ||
        lower.includes('secret')
      ) {
        out[k] = '***';
      } else if (
        lower === 'authorization' ||
        lower === 'accesstoken' ||
        lower === 'refreshtoken' ||
        lower === 'token'
      ) {
        out[k] = typeof v === 'string' ? maskToken(v) : '***';
      } else if (typeof v === 'object') {
        out[k] = sanitize(v, ancestors, depth + 1);
      } else {
        out[k] = v;
      }
    }
    result = out;
  }
  ancestors.delete(value as object);
  return result;
}
