export interface AuthUser {
  email: string
  // decided server-side from NUXT_ADMIN_EMAILS; the API is the real gate
  isAdmin: boolean
  firstName: string | null
  lastName: string | null
  // colour palette id, null until the person picks one
  palette: string | null
  onboardingDismissedAt: string | null
  avatarUrl: string | null
}

// Session state shared across pages; refreshed from /api/auth/me.
export function useAuth () {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const loaded = useState<boolean>('auth-loaded', () => false)

  // What to call someone: their first name if we have one, otherwise
  // everything before the @ in their email.
  const displayName = computed(() => {
    const first = user.value?.firstName?.trim()
    if (first) return first
    return user.value?.email?.split('@')[0]?.trim() ?? ''
  })

  async function refresh () {
    try {
      // During SSR, internal $fetch does NOT forward the browser's cookies, so
      // the session has to be passed through explicitly — otherwise every
      // server-rendered request looks signed out.
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
      const data = await $fetch<{ user: AuthUser | null }>('/api/auth/me', { headers })
      user.value = data.user
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function logout () {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, loaded, displayName, refresh, logout }
}
