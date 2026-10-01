// Removes one of the signed-in account's passkeys. Never a lockout: the
// email link still works with none left.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id || id.length > 1364) {
    throw createError({ statusCode: 400, statusMessage: 'Which passkey?' })
  }
  if (!await deleteUserPasskey(user.id, id)) {
    throw createError({ statusCode: 404, statusMessage: 'That passkey is already gone.' })
  }
  return await passkeyListFor(event, user.id)
})
