import { generateRegistrationOptions } from '@simplewebauthn/server'
import { MAX_PASSKEYS } from '#shared/types/passkey'

// Starts adding a passkey to the signed-in account.
export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const user = await getUserById(session.id)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in required' })

  const existing = await listUserPasskeys(user.id)
  if (existing.length >= MAX_PASSKEYS) {
    throw createError({ statusCode: 400, statusMessage: `You have ${MAX_PASSKEYS} passkeys already — remove one first.` })
  }

  const { rpID, rpName } = relyingParty(event)
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: displayNameOf(user),
    userID: userHandleBytes(user.id),
    // A device that already holds one of these refuses to make another.
    excludeCredentials: existing.map(p => ({ id: p.id, transports: splitTransports(p.transports) })),
    // Discoverable, so sign-in needs no email typed first.
    authenticatorSelection: { residentKey: 'required', userVerification: PASSKEY_USER_VERIFICATION }
  })
  return { options, challengeToken: await issueChallengeToken('register', options.challenge, user.id) }
})
