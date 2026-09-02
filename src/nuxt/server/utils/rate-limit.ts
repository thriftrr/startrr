// Fixed-window rate limiting backed by KV. Approximate by design (KV is
// eventually consistent), which is fine for abuse limiting — the goal is
// bounding email sends and token guesses, not exact accounting.
interface WindowRule {
  key: string
  limit: number
  windowSeconds: number
}

export async function assertRateLimit (rules: WindowRule[]): Promise<void> {
  // The limits exist to protect production email sends and KV/D1 budgets;
  // in dev they only get in the way of iterating on the login flow.
  if (import.meta.dev) return

  const now = Date.now()
  for (const rule of rules) {
    const bucket = Math.floor(now / (rule.windowSeconds * 1000))
    const k = `ratelimit:${rule.key}:${rule.windowSeconds}:${bucket}`
    const count = await kv.get<number>(k).catch(() => null) ?? 0
    if (count >= rule.limit) {
      throw createError({ statusCode: 429, statusMessage: 'Too many requests — wait a bit and try again.' })
    }
    try {
      // Cloudflare KV enforces a 60s minimum TTL.
      await kv.set(k, count + 1, { ttl: Math.max(rule.windowSeconds, 60) })
    } catch {
      // KV allows one write/second per key, so a burst can make this write
      // fail. A burst is exactly what we're limiting — fail closed as a 429
      // rather than surfacing a 500.
      throw createError({ statusCode: 429, statusMessage: 'Too many requests — wait a bit and try again.' })
    }
  }
}

// Cloudflare puts the real client address in cf-connecting-ip. Off
// Cloudflare, X-Forwarded-For is only honored when NUXT_TRUST_PROXY=1 —
// otherwise any client could pick its own rate-limit bucket. Local dev has
// neither header, so everything shares one bucket there — harmless.
export function clientIp (event: Parameters<typeof getRequestIP>[0]): string {
  const { trustProxy } = useRuntimeConfig()
  return getHeader(event, 'cf-connecting-ip')
    || getRequestIP(event, { xForwardedFor: Boolean(trustProxy) })
    || 'unknown'
}
