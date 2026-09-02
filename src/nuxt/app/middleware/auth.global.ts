// Signed-out visitors land on the sign-in page. Only the sign-in pages
// themselves are public; add marketing pages and the like to PUBLIC_ROUTES.
const PUBLIC_ROUTES = ['/login', '/auth/verify']

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTES.some(path => to.path === path || to.path.startsWith(`${path}/`))) return

  const { user, loaded, refresh } = useAuth()
  if (!loaded.value) await refresh()
  if (user.value) return

  // Remember where they were headed so the magic link drops them there
  // instead of on the home page.
  const redirect = to.fullPath !== '/' ? { redirect: to.fullPath } : undefined
  return navigateTo({ path: '/login', query: redirect })
})
