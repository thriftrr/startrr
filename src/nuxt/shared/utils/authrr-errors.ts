// Why a sign-in through Authrr failed. The callback puts a code in the
// /login URL rather than a sentence, so a crafted link can't make the
// sign-in page say whatever it likes.
export const AUTHRR_ERRORS = {
  'expired': 'That sign-in took too long or started in another browser. Try again.',
  'mismatch': 'That sign-in didn\'t match the one this browser started. Try again.',
  'wrong-issuer': 'That sign-in came back from the wrong place.',
  'denied': 'Your account doesn\'t have access to this app.',
  'failed': 'Authrr couldn\'t sign you in. Try again.',
  'unreachable': 'Could not reach Authrr. Try again in a moment.',
  'bad-client': 'This app\'s Authrr settings are wrong — tell whoever runs it.',
  'bad-token': 'Authrr\'s sign-in didn\'t check out. Try again.',
  'linked-elsewhere': 'This email is already linked to a different Authrr account.',
  'full': 'Sign-ups are full right now — check back later.'
} as const

export type AuthrrErrorCode = keyof typeof AUTHRR_ERRORS

export function authrrErrorMessage (code: unknown): string {
  return typeof code === 'string' && code in AUTHRR_ERRORS
    ? AUTHRR_ERRORS[code as AuthrrErrorCode]
    : AUTHRR_ERRORS.failed
}
