// One row of the account page's passkey list.
export interface PasskeySummary {
  id: string
  // The provider when it's one we recognise ("Apple Passwords",
  // "1Password"); null for the rest.
  provider: string | null
  // Synced to a cloud keychain, so it survives losing the device.
  synced: boolean
  // The browser it was added from — a label, not a fingerprint.
  userAgent: string
  createdAt: string
  lastUsedAt: string | null
}

// What the account API returns after any change, so the page never needs a
// second fetch. rpID and userHandle let the browser hide passkeys that are no
// longer on the list (the WebAuthn Signal API).
export interface PasskeyList {
  passkeys: PasskeySummary[]
  rpID: string
  userHandle: string
}

// The account page caps passkeys at this many; the server enforces it.
export const MAX_PASSKEYS = 10
