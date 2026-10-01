import { generateAuthenticationOptions } from '@simplewebauthn/server'

// Starts a passkey sign-in. No email and no allow-list: the browser offers
// whichever passkeys it holds for this site (the account is identified by
// the one picked), so nothing here reveals whether an address has an account.
export default defineEventHandler(async (event) => {
  const { rpID } = relyingParty(event)
  const options = await generateAuthenticationOptions({ rpID, userVerification: PASSKEY_USER_VERIFICATION })
  return { options, challengeToken: await issueChallengeToken('login', options.challenge) }
})
