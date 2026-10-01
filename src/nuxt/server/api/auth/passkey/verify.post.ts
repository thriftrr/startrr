import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'

export default defineEventHandler(async (event) => {
  // A signature can't be guessed, so this only keeps the endpoint from
  // being hammered for free — the same budget as the magic-link verifier.
  await assertRateLimit([{ key: `passkey-ip:${clientIp(event)}`, limit: 30, windowSeconds: 600 }])

  const body = await readBody<{ response?: unknown, challengeToken?: unknown }>(event)
  const response = readCredentialResponse<AuthenticationResponseJSON>(body?.response)
  if (!response) {
    throw createError({ statusCode: 400, statusMessage: 'That passkey response was malformed — try again.' })
  }
  const challenge = await spendChallengeToken(body?.challengeToken, 'login')

  const passkey = await findPasskey(response.id)
  const user = passkey ? await getUserById(passkey.userId) : null
  if (!passkey || !user) {
    // `unknownCredential` tells the page to ask the browser to stop offering
    // it — it was removed here but still sits in someone's keychain.
    throw createError({
      statusCode: 400,
      statusMessage: 'That passkey isn\'t set up here any more. Sign in with an email link instead.',
      data: { unknownCredential: true }
    })
  }

  const failed = createError({ statusCode: 400, statusMessage: 'That passkey didn\'t check out — try again, or use an email link.' })

  // The account was found by credential id; the spec also has the
  // authenticator name the account it thinks it's for, and they must agree.
  if (response.response.userHandle !== userHandleOf(user.id)) throw failed

  const { origin, rpID } = relyingParty(event)
  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: passkey.id,
        publicKey: isoBase64URL.toBuffer(passkey.publicKey),
        counter: passkey.counter,
        transports: splitTransports(passkey.transports)
      }
    })
  } catch {
    // Bad signature, wrong origin, or a counter that went backwards (a
    // cloned authenticator) — none of which deserve more detail.
    throw failed
  }
  if (!verification.verified) throw failed

  const { newCounter, credentialBackedUp } = verification.authenticationInfo
  await recordPasskeyUse(passkey.id, newCounter, credentialBackedUp)
  await startSession(event, { id: user.id, email: user.email })
  return { user: { email: user.email } }
})
