/**
 * Simple in-memory sliding-window-ish rate limiter.
 *
 * Notes:
 * - Process-local state. In a multi-instance deployment (Vercel serverless),
 *   each lambda instance has its own map, so the effective limit scales with
 *   the number of concurrent instances. This is still a useful first line
 *   of defense against bursts from a single IP/user.
 * - Upstash / Redis can be plugged in later by swapping this helper.
 */
const buckets = new Map();

// Periodic cleanup to prevent unbounded growth.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function maybeCleanup(now) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [k, v] of buckets.entries()) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

/**
 * Check and increment the rate-limit bucket for a given key.
 *
 * @param {string} key - unique identifier (e.g. `checkout:1.2.3.4`).
 * @param {number} limit - max requests per window.
 * @param {number} windowMs - window size in milliseconds.
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function checkRateLimit(key, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  maybeCleanup(now);

  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
  }
  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/**
 * Extract a best-effort client IP from common proxy headers.
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
export function getClientIp(req) {
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return String(xff[0]).split(',')[0].trim();
  }
  return (
    req.headers?.['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}
