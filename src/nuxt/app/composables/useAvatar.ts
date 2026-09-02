// Profile picture resolution, shared by the sidebar and the Account page so
// they can never show different faces: an uploaded photo wins, Gravatar is the
// fallback, initials are the last resort.
export function useAvatar () {
  const { user } = useAuth()
  const gravatarUrl = ref('')

  const hasCustom = computed(() => Boolean(user.value?.avatarUrl))
  const avatarUrl = computed(() => user.value?.avatarUrl || gravatarUrl.value)
  const source = computed(() => hasCustom.value ? 'custom upload' : 'via Gravatar')

  const initials = computed(() => {
    const f = user.value?.firstName?.trim()[0] ?? ''
    const l = user.value?.lastName?.trim()[0] ?? ''
    if (f || l) return (f + l).toUpperCase()
    return (user.value?.email ?? '').slice(0, 2).toUpperCase() || '··'
  })

  // Gravatar keys off the SHA-256 of the lowercased email, per the design.
  // Needs a secure context; falls back to initials when unavailable.
  watch(() => user.value?.email, async (email) => {
    gravatarUrl.value = ''
    if (!email) return
    try {
      const bytes = new TextEncoder().encode(email.trim().toLowerCase())
      const buf = await crypto.subtle.digest('SHA-256', bytes)
      const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
      gravatarUrl.value = `https://www.gravatar.com/avatar/${hash}?s=168&d=identicon`
    } catch { /* initials carry it */ }
  }, { immediate: true })

  return { avatarUrl, initials, hasCustom, source }
}
