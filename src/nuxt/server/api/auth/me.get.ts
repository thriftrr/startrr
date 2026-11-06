export default defineEventHandler(async (event) => {
  const session = await getSessionUser(event)
  if (!session) return { user: null }
  const user = await getUserById(session.id)
  if (!user) {
    await endSession(event)
    return { user: null }
  }
  return {
    user: {
      email: user.email,
      isAdmin: isAdminUser(user),
      firstName: user.firstName,
      lastName: user.lastName,
      palette: user.palette ?? null,
      onboardingDismissedAt: user.onboardingDismissedAt ?? null,
      // Cache-bust on the key so a replaced photo shows up immediately.
      // An upload here wins; then Authrr's photo; then the page's Gravatar.
      avatarUrl: user.avatarKey ? `/api/account/avatar?v=${encodeURIComponent(user.avatarKey)}` : user.pictureUrl ?? null
    }
  }
})
