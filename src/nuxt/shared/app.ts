// The one place the app's identity lives. `make rename NAME=Foo` rewrites
// every "startrr" / "Startrr" in the repo; edit the tagline and description
// here by hand afterwards.
export const APP_NAME = 'Startrr'
export const APP_SLUG = 'startrr'
// Light or dark: this app's look, which its Authrr sign-in window matches
// (with the palette in use). Change it if the app's design goes dark.
export const APP_SCHEME: 'light' | 'dark' = 'light'
export const APP_TAGLINE = 'A starting place for a simple web app'
export const APP_DESCRIPTION = 'Passwordless accounts, profiles, and a Cloudflare deployment — ready for the features that make it yours.'

// Sender name on outgoing email and the ko-fi link in the footer. Set
// SUPPORT_URL to '' to drop the footer link entirely.
export const SUPPORT_URL = 'https://ko-fi.com/tubstrr'
export const SUPPORT_LABEL = 'support tubstrr on Ko-fi'
