import type { H3Event } from 'h3'
import { APP_NAME } from '#shared/app'

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

// Transports, in order of preference:
// 1. Cloudflare Email Sending via the Workers `send_email` binding (deployed)
// 2. Cloudflare Email Sending via the REST API (works anywhere, needs a token)
// 3. Dev: log to the server console — the console IS the outbox
// Outside dev with nothing configured we fail closed rather than leak links
// into logs.
export async function sendEmail (event: H3Event, message: EmailMessage): Promise<void> {
  const { cfAccountId, cfEmailToken, emailFrom } = useRuntimeConfig()

  const binding = (event.context as { cloudflare?: { env?: { EMAIL?: { send: (m: unknown) => Promise<void> } } } })
    .cloudflare?.env?.EMAIL
  if (binding && emailFrom) {
    await binding.send({
      to: message.to,
      from: { email: emailFrom, name: APP_NAME },
      subject: message.subject,
      text: message.text,
      html: message.html
    })
    return
  }

  if (cfAccountId && cfEmailToken && emailFrom) {
    await $fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/email/sending/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfEmailToken}` },
      body: {
        to: message.to,
        from: { address: emailFrom, name: APP_NAME },
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {})
      }
    })
    return
  }

  if (import.meta.dev) {
    console.log([
      '',
      '── sendEmail (dev transport) ──────────────────────────',
      `To:      ${message.to}`,
      `Subject: ${message.subject}`,
      '',
      message.text,
      '───────────────────────────────────────────────────────',
      ''
    ].join('\n'))
    return
  }

  throw createError({ statusCode: 503, statusMessage: 'Email transport not configured' })
}
