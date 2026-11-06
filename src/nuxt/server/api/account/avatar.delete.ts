// Drops the uploaded photo and falls the profile back to Gravatar. Through
// Authrr, ?scope=app drops just this app's own photo (back to the one every
// app shows); otherwise the photo every app shows.
export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  // Each call may go on to Authrr, whose budget this app shares.
  await assertRateLimit([{ key: `settings:${session.id}`, limit: 120, windowSeconds: 600 }])
  if (authrrEnabled()) {
    await removeAuthrrPhoto(event, session.id, getQuery(event).scope === 'app' ? 'app' : 'global')
    return { ok: true }
  }
  const user = await getUserById(session.id)
  if (user?.avatarKey) {
    try {
      await blob.delete(`avatars/${session.id}`)
    } catch { /* already gone — clearing the key below is what matters */ }
    await setUserAvatarKey(session.id, null)
  }
  return { ok: true }
})
