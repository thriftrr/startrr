import { createHash, randomBytes, webcrypto } from 'node:crypto'
import { isoCBOR } from '@simplewebauthn/server/helpers'
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON
} from '@simplewebauthn/server'

// A passkey provider in software, so the e2e suite can run real WebAuthn
// ceremonies against the server with no browser: ES256 keys, "none"
// attestation, and the exact bytes a platform authenticator would send.
// Each knob a test needs to misbehave (origin, counter) is a parameter.

const FLAG_UP = 0x01 // user present
const FLAG_UV = 0x04 // user verified
const FLAG_BE = 0x08 // backup eligible
const FLAG_BS = 0x10 // backed up
const FLAG_AT = 0x40 // attested credential data follows

export const APPLE_PASSWORDS_AAGUID = 'fbfc3007-154e-4ecc-8c0b-6e020557d7bd'

export interface SoftPasskey {
  id: string
  keys: webcrypto.CryptoKeyPair
  userHandle: string
  counter: number
}

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url')
const sha256 = (data: Uint8Array | string) => new Uint8Array(createHash('sha256').update(data).digest())
const u32 = (n: number) => Uint8Array.of(n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff)

function concat (...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

// WebCrypto signs ECDSA as raw r||s; WebAuthn wants ASN.1 DER.
function der (raw: Uint8Array): Uint8Array {
  const integer = (bytes: Uint8Array) => {
    let start = 0
    while (start < bytes.length - 1 && bytes[start] === 0) start++
    let value = bytes.slice(start)
    if ((value[0] ?? 0) & 0x80) value = concat(Uint8Array.of(0), value)
    return concat(Uint8Array.of(0x02, value.length), value)
  }
  const r = integer(raw.slice(0, 32))
  const s = integer(raw.slice(32))
  return concat(Uint8Array.of(0x30, r.length + s.length), r, s)
}

function clientData (type: string, challenge: string, origin: string): string {
  return JSON.stringify({ type, challenge, origin, crossOrigin: false })
}

export async function createPasskey (
  options: PublicKeyCredentialCreationOptionsJSON,
  origin: string,
  aaguid = APPLE_PASSWORDS_AAGUID
): Promise<{ passkey: SoftPasskey, response: RegistrationResponseJSON }> {
  const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey)
  const coseKey = isoCBOR.encode(new Map<number, number | Uint8Array>([
    [1, 2], // kty: EC2
    [3, -7], // alg: ES256
    [-1, 1], // crv: P-256
    [-2, Buffer.from(jwk.x ?? '', 'base64url')],
    [-3, Buffer.from(jwk.y ?? '', 'base64url')]
  ]))

  const id = new Uint8Array(randomBytes(32))
  const authData = concat(
    sha256(options.rp.id ?? ''),
    Uint8Array.of(FLAG_UP | FLAG_UV | FLAG_BE | FLAG_BS | FLAG_AT),
    u32(0),
    Buffer.from(aaguid.replace(/-/g, ''), 'hex'),
    Uint8Array.of(id.length >> 8, id.length & 0xff),
    id,
    coseKey
  )
  const attestationObject = isoCBOR.encode(new Map<string, string | Uint8Array | Map<string, never>>([
    ['fmt', 'none'],
    ['attStmt', new Map()],
    ['authData', authData]
  ]))

  return {
    passkey: { id: b64url(id), keys, userHandle: options.user.id, counter: 0 },
    response: {
      id: b64url(id),
      rawId: b64url(id),
      type: 'public-key',
      response: {
        clientDataJSON: b64url(Buffer.from(clientData('webauthn.create', options.challenge, origin))),
        attestationObject: b64url(attestationObject),
        transports: ['internal', 'hybrid']
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform'
    }
  }
}

// Signs a sign-in challenge. The counter goes up by one unless a test pins it.
export async function usePasskey (
  passkey: SoftPasskey,
  options: PublicKeyCredentialRequestOptionsJSON,
  origin: string,
  counter = passkey.counter + 1
): Promise<AuthenticationResponseJSON> {
  passkey.counter = counter
  const authData = concat(
    sha256(options.rpId ?? ''),
    Uint8Array.of(FLAG_UP | FLAG_UV | FLAG_BE | FLAG_BS),
    u32(counter)
  )
  const clientDataJSON = Buffer.from(clientData('webauthn.get', options.challenge, origin))
  const signature = new Uint8Array(await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    passkey.keys.privateKey,
    concat(authData, sha256(clientDataJSON))
  ))
  return {
    id: passkey.id,
    rawId: passkey.id,
    type: 'public-key',
    response: {
      clientDataJSON: b64url(clientDataJSON),
      authenticatorData: b64url(authData),
      signature: b64url(der(signature)),
      userHandle: passkey.userHandle
    },
    clientExtensionResults: {},
    authenticatorAttachment: 'platform'
  }
}
