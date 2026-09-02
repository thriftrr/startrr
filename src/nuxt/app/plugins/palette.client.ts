import { isPaletteId } from '#shared/types/palette'

// Seeds the local palette choice from localStorage before the app renders,
// and keeps localStorage in step with the account's saved palette so the
// pre-paint script (app.vue) stamps the right one on the next reload.
export default defineNuxtPlugin(() => {
  const { set, STORAGE_KEY } = usePalette()
  const { user } = useAuth()

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isPaletteId(stored)) set(stored)
  } catch { /* storage blocked — default palette */ }

  watch(() => user.value?.palette, (saved) => {
    if (isPaletteId(saved)) set(saved)
  }, { immediate: true })
})
