import { APP_SLUG } from '#shared/app'
import { DEFAULT_PALETTE, isPaletteId } from '#shared/types/palette'

const STORAGE_KEY = `${APP_SLUG}:palette`

// The active colour palette. Three layers keep it flash-free and portable:
//   1. an inline <head> script (app.vue) stamps data-palette from localStorage
//      before first paint,
//   2. the signed-in account's saved palette wins on server AND client (the
//      auth middleware loads the user during SSR, so both render the same),
//   3. the local choice (a session that hasn't loaded yet) comes from
//      localStorage and is mirrored there on change.
export function usePalette () {
  const local = useState<string>('palette-local', () => DEFAULT_PALETTE)
  const { user } = useAuth()

  const palette = computed(() => {
    const saved = user.value?.palette
    return isPaletteId(saved) ? saved : local.value
  })

  function remember (id: string) {
    try {
      if (id === DEFAULT_PALETTE) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, id)
    } catch { /* storage blocked — the choice lasts this session */ }
  }

  // Local choice, no round trip. Callers that own a session persist it.
  function set (id: string) {
    if (!isPaletteId(id)) return
    local.value = id
    if (import.meta.client) remember(id)
  }

  async function save (id: string) {
    set(id)
    if (!user.value) return
    await $fetch('/api/account/profile', { method: 'PATCH', body: { palette: id } })
    user.value = { ...user.value, palette: id }
  }

  return { palette, set, save, STORAGE_KEY }
}
