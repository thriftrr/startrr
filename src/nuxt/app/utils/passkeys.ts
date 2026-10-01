import {
  WebAuthnAbortService,
  WebAuthnError,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  platformAuthenticatorIsAvailable,
  sendSignal,
  startAuthentication,
  startRegistration
} from '@simplewebauthn/browser'
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { APP_SLUG } from '#shared/app'
import type { PasskeyList } from '#shared/types/passkey'

// Passkeys, browser side. Every ceremony is the same three steps: ask the
// server for options (a challenge plus a token vouching for it), let the
// browser talk to the authenticator, hand the answer back with the token.

export function passkeysSupported (): boolean {
  return browserSupportsWebAuthn()
}

// Passkeys offered in the email field's autofill dropdown.
export async function passkeyAutofillSupported (): Promise<boolean> {
  return await browserSupportsWebAuthnAutofill().catch(() => false)
}

// Touch ID, Windows Hello, a phone's screen lock — a passkey without a QR
// code or a security key. The verify page only offers one when this is true.
export async function passkeyDeviceAvailable (): Promise<boolean> {
  return await platformAuthenticatorIsAvailable().catch(() => false)
}

// Resolves once the server has started a session. With `autofill` the
// request waits quietly until a passkey is picked from the email field.
export async function signInWithPasskey (autofill = false): Promise<void> {
  const { options, challengeToken } = await $fetch<{ options: PublicKeyCredentialRequestOptionsJSON, challengeToken: string }>(
    '/api/auth/passkey/options', { method: 'POST' }
  )
  const response = await startAuthentication({ optionsJSON: options, useBrowserAutofill: autofill })
  try {
    await $fetch('/api/auth/passkey/verify', { method: 'POST', body: { response, challengeToken } })
  } catch (cause) {
    // Removed here but still in the keychain: ask the browser to stop
    // offering it. Best effort — most browsers don't support signals yet.
    const data = (cause as { data?: { data?: { unknownCredential?: boolean } } }).data?.data
    if (data?.unknownCredential && options.rpId) {
      await sendSignal({ signalName: 'unknownCredential', rpID: options.rpId, credentialID: response.id }).catch(() => {})
    }
    throw cause
  }
}

export async function addPasskey (): Promise<PasskeyList> {
  const { options, challengeToken } = await $fetch<{ options: PublicKeyCredentialCreationOptionsJSON, challengeToken: string }>(
    '/api/account/passkeys/options', { method: 'POST' }
  )
  const response = await startRegistration({ optionsJSON: options })
  return await $fetch<PasskeyList>('/api/account/passkeys', { method: 'POST', body: { response, challengeToken } })
}

export async function removePasskey (id: string): Promise<PasskeyList> {
  const list = await $fetch<PasskeyList>(`/api/account/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' })
  // Tell the browser which passkeys still count, so the removed one stops
  // turning up at sign-in. Best effort, as above.
  sendSignal({
    signalName: 'allAcceptedCredentials',
    rpID: list.rpID,
    userID: list.userHandle,
    allAcceptedCredentialIDs: list.passkeys.map(p => p.id)
  }).catch(() => {})
  return list
}

// Closes the browser's passkey prompt or autofill offer, if one is open.
export function cancelPasskeyRequest () {
  WebAuthnAbortService.cancelCeremony()
}

// We (or a newer request) closed it — nothing went wrong.
export function isPasskeyAbort (cause: unknown): boolean {
  return cause instanceof WebAuthnError && cause.code === 'ERROR_CEREMONY_ABORTED'
}

// The server answered: its sentence is the one to show.
export function isPasskeyServerError (cause: unknown): boolean {
  return typeof (cause as { data?: { statusMessage?: unknown } })?.data?.statusMessage === 'string'
}

// What to tell the person after a failed ceremony. `dismissed` is for when
// they closed the prompt (browsers report that and a timeout alike);
// an empty string means say nothing.
export function passkeyErrorMessage (cause: unknown, dismissed: string): string {
  if (isPasskeyAbort(cause)) return ''
  if (isPasskeyServerError(cause)) return (cause as { data: { statusMessage: string } }).data.statusMessage
  if (cause instanceof WebAuthnError) {
    if (cause.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') return 'This device already has a passkey for your account.'
    if (cause.code === 'ERROR_INVALID_DOMAIN' || cause.code === 'ERROR_INVALID_RP_ID') {
      return 'Passkeys don\'t work at this address — open the app at its usual URL.'
    }
  }
  if (cause instanceof Error && cause.name === 'NotAllowedError') return dismissed
  return 'Something went wrong with the passkey — try again.'
}

// "Not now" on the verify page's offer, remembered per browser: a passkey
// usually lives on one device, so another device still gets asked.
const PROMPT_KEY = `${APP_SLUG}:passkey-offer`

export function passkeyOfferDismissed (): boolean {
  try {
    return localStorage.getItem(PROMPT_KEY) === 'dismissed'
  } catch {
    return false
  }
}

export function dismissPasskeyOffer () {
  try {
    localStorage.setItem(PROMPT_KEY, 'dismissed')
  } catch { /* fine — they'll be asked again next time */ }
}
