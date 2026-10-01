import { verifyRegistrationResponse } from '@simplewebauthn/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { MAX_PASSKEYS } from '#shared/types/passkey'

const MAX_UA = 300

// Finishes adding a passkey: checks the authenticator's answer to the
// challenge from options.post.ts and stores the public key.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await assertRateLimit([{ key: `passkey-add:${user.id}`, limit: 10, windowSeconds: 3_600 }])

  const body = await readBody<{ response?: unknown, challengeToken?: unknown }>(event)
  const response = readCredentialResponse<RegistrationResponseJSON>(body?.response)
  if (!response) {
    throw createError({ statusCode: 400, statusMessage: 'That passkey response was malformed — try again.' })
  }
  const challenge = await spendChallengeToken(body?.challengeToken, 'register', user.id)

  const { origin, rpID } = relyingParty(event)
  const failed = createError({ statusCode: 400, statusMessage: 'We couldn\'t verify that passkey — try again.' })
  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false
    })
  } catch {
    throw failed
  }
  if (!verification.verified) throw failed

  // Checked again here: two tabs could each have fetched options at nine.
  if (await countUserPasskeys(user.id) >= MAX_PASSKEYS) {
    throw createError({ statusCode: 400, statusMessage: `You have ${MAX_PASSKEYS} passkeys already — remove one first.` })
  }

  const { credential, credentialBackedUp, aaguid } = verification.registrationInfo
  const added = await insertPasskey({
    id: credential.id,
    userId: user.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: (credential.transports ?? []).join(','),
    backedUp: credentialBackedUp,
    aaguid,
    userAgent: (getRequestHeader(event, 'user-agent') ?? '').slice(0, MAX_UA),
    createdAt: new Date().toISOString(),
    lastUsedAt: null
  })
  if (!added) {
    throw createError({ statusCode: 409, statusMessage: 'That passkey is already set up.' })
  }

  return await passkeyListFor(event, user.id)
})
