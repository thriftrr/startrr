// The account page's passkey list.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return await passkeyListFor(event, user.id)
})
