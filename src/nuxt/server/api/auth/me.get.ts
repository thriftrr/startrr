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
      isAdmin: isAdminEmail(user.email),
      firstName: user.firstName,
      lastName: user.lastName,
      palette: user.palette ?? null,
      onboardingDismissedAt: user.onboardingDismissedAt ?? null,
      // Cache-bust on the key so a replaced photo shows up immediately.
      avatarUrl: user.avatarKey ? `/api/account/avatar?v=${encodeURIComponent(user.avatarKey)}` : null
    }
  }
})
