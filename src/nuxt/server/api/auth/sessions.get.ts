// The account page's "where you're signed in" list.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await listUserSessions(user.id)
  return {
    sessions: rows
      .map(row => ({
        id: row.id,
        current: row.id === user.sessionId,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
        lastSeenAt: row.lastSeenAt
      }))
      .sort((a, b) => Number(b.current) - Number(a.current) || b.lastSeenAt.localeCompare(a.lastSeenAt))
  }
})
