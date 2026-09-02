// Streams the signed-in user's avatar back out of blob storage. Private by
// design: the object is never publicly addressable, only via this session.
export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const user = await getUserById(session.id)
  if (!user?.avatarKey) {
    throw createError({ statusCode: 404, statusMessage: 'No profile picture uploaded' })
  }
  // Each upload gets a fresh cache-busted key, so the bytes behind a given
  // ?v= never change — let the browser hold onto them.
  setHeader(event, 'cache-control', 'private, max-age=31536000, immutable')
  return blob.serve(event, `avatars/${session.id}`)
})
