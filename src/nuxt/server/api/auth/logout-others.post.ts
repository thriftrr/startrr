// "Sign out everywhere else": revokes every other session for this account
// and keeps the one asking.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const revoked = await deleteUserSessions(user.id, user.sessionId)
  return { ok: true, revoked }
})
