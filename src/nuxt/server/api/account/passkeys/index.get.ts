// The account page's passkey list.
export default defineEventHandler(async (event) => {
  // Local accounts only: with Authrr configured, sign-in happens there.
  assertLocalAccounts()
  const user = await requireUser(event)
  return await passkeyListFor(event, user.id)
})
