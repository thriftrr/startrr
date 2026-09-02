// Drops the uploaded photo and falls the profile back to Gravatar.
export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const user = await getUserById(session.id)
  if (user?.avatarKey) {
    try {
      await blob.delete(`avatars/${session.id}`)
    } catch { /* already gone — clearing the key below is what matters */ }
    await setUserAvatarKey(session.id, null)
  }
  return { ok: true }
})
