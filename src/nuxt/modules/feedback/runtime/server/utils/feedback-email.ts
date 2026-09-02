import { APP_NAME } from '#shared/app'
import { EMAIL_FONT, emailWordmark, escapeHtml, type EmailTemplate } from '../../../../../server/utils/email-templates'

// Sent to the admins when someone submits feedback. Everything user-supplied
// (name, email, page, body) is escaped; the Markdown body is shown as plain
// preformatted text, not rendered — the inbox page does the rendering.
export interface FeedbackEmailInput {
  name: string
  email: string
  body: string
  page: string
  receivedAt: Date
  inboxUrl: string
}

export function feedbackEmail (input: FeedbackEmailInput): EmailTemplate {
  const name = escapeHtml(input.name)
  const email = escapeHtml(input.email)
  const page = escapeHtml(input.page || '—')
  const bodySafe = escapeHtml(input.body)
  const when = input.receivedAt.toUTCString()

  const subject = `${APP_NAME} feedback from ${input.name}`
  const text = [
    `New feedback on ${APP_NAME}`,
    '',
    `From: ${input.name} <${input.email}>`,
    `Page: ${input.page || '—'}`,
    `When: ${when}`,
    '',
    input.body,
    '',
    `Inbox: ${input.inboxUrl}`
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#faf6ef;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#faf6ef;">
  <tr><td align="center" style="padding:32px 16px 40px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:100%;">
      <tr><td align="left" style="padding:0 8px 18px;">
        ${emailWordmark()}
      </td></tr>
      <tr><td style="background-color:#ffffff; border-radius:14px; padding:28px 28px 24px;">
        <div style="font-family:${EMAIL_FONT}; font-size:18px; font-weight:bold; color:#2b2a26; margin:0 0 14px;">New feedback</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:${EMAIL_FONT}; font-size:13px; color:#6f6a5c; line-height:1.6;">
          <tr><td style="padding-right:12px; font-weight:bold;">From</td><td style="color:#2b2a26;">${name} &lt;${email}&gt;</td></tr>
          <tr><td style="padding-right:12px; font-weight:bold;">Page</td><td style="color:#2b2a26;">${page}</td></tr>
          <tr><td style="padding-right:12px; font-weight:bold;">When</td><td style="color:#2b2a26;">${escapeHtml(when)}</td></tr>
        </table>
        <pre style="margin:18px 0 0; padding:14px 16px; background-color:#faf6ef; border:1px solid #e5dfd3; border-radius:10px; font-family:ui-monospace, Menlo, Consolas, monospace; font-size:12.5px; line-height:1.55; color:#2b2a26; white-space:pre-wrap; word-wrap:break-word;">${bodySafe}</pre>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
          <tr><td bgcolor="#12968b" style="border-radius:9px;">
            <a href="${input.inboxUrl}" style="display:inline-block; padding:10px 18px; font-family:${EMAIL_FONT}; font-size:13px; font-weight:bold; color:#ffffff; text-decoration:none;">Open the inbox</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  return { subject, text, html }
}
