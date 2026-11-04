import type { H3Event } from 'h3'

// Admin is decided by email (NUXT_ADMIN_EMAILS, comma-separated) — no UI to
// grant it here. Every account starts with a magic link (passkeys are only
// added from a signed-in session), so owning the address IS the proof.
// Signed in through Authrr, its `admin` role counts too: that's where
// admins are made for every app at once.
export function adminEmails (): string[] {
  const { adminEmails: raw } = useRuntimeConfig()
  return String(raw ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export function isAdminEmail (email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails().includes(email.trim().toLowerCase())
}

export function isAdminUser (user: { email: string, role?: string | null }): boolean {
  return isAdminEmail(user.email) || (authrrEnabled() && user.role === 'admin')
}

export async function requireAdmin (event: H3Event): Promise<SessionUser> {
  const user = await requireUser(event)
  const row = await getUserById(user.id)
  if (!row || !isAdminUser(row)) {
    throw createError({ statusCode: 403, statusMessage: 'Admins only' })
  }
  return user
}
