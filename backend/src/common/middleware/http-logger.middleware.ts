import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

/**
 * Verbose HTTP request/response logger.
 *
 * For each non-skipped request, logs:
 *   - Method + full URL + status + size + duration + user + ip
 *   - Request body (sanitized)
 *   - Response body (sanitized, captured by wrapping `res.json`)
 *
 * Secrets in known fields (password, token, authorization, ...) are masked.
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  private static readonly SKIP_PREFIXES = [
    "/api/health",
    "/api/docs",
    "/uploads",
  ];

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    const { method, originalUrl } = req;

    if (
      HttpLoggerMiddleware.SKIP_PREFIXES.some((p) => originalUrl.startsWith(p))
    ) {
      return next();
    }

    // Capture response body by wrapping res.json (Nest always uses res.json)
    let capturedBody: unknown;
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      capturedBody = body;
      return originalJson(body);
    };

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const { statusCode } = res;
      const contentLength = res.get("content-length") ?? "-";
      const userId = (req as any).user?.userId;
      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.ip;
      const host = `${req.protocol}://${req.get("host") ?? ""}`;
      const fullUrl = `${host}${originalUrl}`;

      const summary =
        `${method} ${fullUrl} ${statusCode} ${contentLength}b ${durationMs.toFixed(1)}ms` +
        (userId ? ` user=${userId}` : "") +
        (ip ? ` ip=${ip}` : "");

      const level =
        statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "log";

      this.logger[level](summary);

      // Body dumps — pretty-printed for readability, sanitized for safety
      if (req.body && Object.keys(req.body).length > 0) {
        this.logger[level](`  body: ${safeStringify(req.body)}`);
      }
      if (capturedBody != null) {
        this.logger[level](`  response: ${safeStringify(capturedBody)}`);
      }
    });

    next();
  }
}

function maskToken(value: string): string {
  const m = value.match(/^(Bearer\s+)?(.+)$/i);
  if (!m) return value;
  const prefix = m[1] ?? "";
  const tok = m[2];
  if (tok.length <= 8) return `${prefix}***`;
  return `${prefix}${tok.slice(0, 4)}…${tok.slice(-4)}`;
}

/**
 * Pretty-prints a value with secret masking. Robust against:
 *  - Mongoose Document instances (uses toJSON to flatten internal `_doc`/`$__`)
 *  - Circular references (each ancestor tracked in a WeakSet)
 *  - Deep object graphs (hard depth cap)
 */
const MAX_DEPTH = 8;

function safeStringify(value: unknown): string {
  // First pass: convert Mongoose docs / Dates / etc to plain JSON-safe shape.
  // This calls toJSON() which Mongoose Document provides → drops `$__` etc.
  let normalized: unknown;
  try {
    normalized = JSON.parse(JSON.stringify(value));
  } catch {
    // Fallback if JSON.stringify itself blew up on circular structures
    normalized = value;
  }
  try {
    return JSON.stringify(sanitize(normalized, new WeakSet(), 0), null, 2);
  } catch (e: any) {
    return `[unloggable: ${e?.message ?? "unknown"}]`;
  }
}

function sanitize(
  value: unknown,
  ancestors: WeakSet<object>,
  depth: number
): unknown {
  if (depth > MAX_DEPTH) return "[depth limit]";
  if (value == null || typeof value !== "object") return value;
  if (ancestors.has(value as object)) return "[circular]";
  ancestors.add(value as object);
  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map((v) => sanitize(v, ancestors, depth + 1));
  } else {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (
        lower === "password" ||
        lower === "passcode" ||
        lower === "pin" ||
        lower.includes("secret")
      ) {
        out[k] = "***";
      } else if (
        lower === "authorization" ||
        lower === "accesstoken" ||
        lower === "refreshtoken" ||
        lower === "token"
      ) {
        out[k] = typeof v === "string" ? maskToken(v) : "***";
      } else if (typeof v === "object") {
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
