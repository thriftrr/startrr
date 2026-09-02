import type { H3Event } from 'h3'

// Admin is decided by email alone (NUXT_ADMIN_EMAILS, comma-separated) — no
// role column, no UI to grant it. Sign-in is by magic link, so owning the
// address IS the proof.
export function adminEmails (): string[] {
  const { adminEmails: raw } = useRuntimeConfig()
  return String(raw ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export function isAdminEmail (email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails().includes(email.trim().toLowerCase())
}

export async function requireAdmin (event: H3Event): Promise<SessionUser> {
  const user = await requireUser(event)
  if (!isAdminEmail(user.email)) {
    throw createError({ statusCode: 403, statusMessage: 'Admins only' })
  }
  return user
}
