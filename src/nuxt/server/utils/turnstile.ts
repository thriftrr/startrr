import type { H3Event } from 'h3'

// Cloudflare Turnstile, server side. Configured by NUXT_TURNSTILE_SECRET_KEY
// (+ the public site key the widget needs). Unconfigured means skipped: the
// rate limits are still there, the bot check is the extra layer.
export async function assertTurnstile (event: H3Event, token: unknown): Promise<void> {
  const { turnstileSecretKey } = useRuntimeConfig()
  if (!turnstileSecretKey) return

  if (typeof token !== 'string' || !token) {
    throw createError({ statusCode: 400, statusMessage: 'Finish the "are you human" check first.' })
  }
  let result: { success?: boolean }
  try {
    result = await $fetch<{ success?: boolean }>('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: { secret: turnstileSecretKey, response: token, remoteip: clientIp(event) }
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Could not verify the bot check — try again.' })
  }
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: 'The bot check failed — reload and try again.' })
  }
}
