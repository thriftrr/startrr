import { APP_DESCRIPTION, APP_NAME, APP_SLUG } from './shared/app'

// A deployed origin (https, a real hostname, nothing after it) becomes the
// worker's custom domain. Anything else — unset, localhost, a typo with a
// path — adds no route, and scripts/deploy.sh refuses to ship without one.
function customDomainRoutes (origin: string | undefined) {
  if (!origin) return {}
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return {}
  }
  const clean = url.protocol === 'https:' && url.origin === origin.replace(/\/$/, '') && !['localhost', '127.0.0.1'].includes(url.hostname)
  return clean ? { routes: [{ pattern: url.hostname, custom_domain: true }] } : {}
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Self-hosted Cloudflare deployment: production swaps the local sqlite/fs
  // drivers for D1/KV/R2 bindings that YOU create in your own account (see
  // "Deploying" in the root README). The ids come from .env at build time so
  // the repo carries nothing account-specific. Binding names are NuxtHub's
  // defaults (DB / KV / CACHE / BLOB); the module emits the wrangler config
  // at build time. Dev below keeps using .data/ untouched.

  // Local modules (modules/feedback) are picked up automatically.
  modules: [
    '@nuxt/a11y',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/test-utils/module',
    '@nuxthub/core'
  ],
  $production: {
    hub: {
      cache: { driver: 'cloudflare-kv-binding', namespaceId: process.env.NUXT_CF_KV_CACHE_ID ?? '' },
      db: { dialect: 'sqlite', driver: 'd1', connection: { databaseId: process.env.NUXT_CF_D1_DATABASE_ID ?? '' } },
      kv: { driver: 'cloudflare-kv-binding', namespaceId: process.env.NUXT_CF_KV_ID ?? '' },
      blob: { driver: 'cloudflare-r2', binding: 'BLOB', bucketName: process.env.NUXT_CF_R2_BUCKET ?? '' }
    }
  },
  // The component inspector overlay hijacks clicks in the in-app browser.
  devtools: { enabled: true, componentInspector: false },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: APP_NAME,
      meta: [{ name: 'description', content: APP_DESCRIPTION }],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },

  // Design tokens + base styles; loaded globally so every page and scoped
  // block can read the custom properties.
  css: ['~/assets/css/design.css'],

  runtimeConfig: {
    // signs session cookies (required in production)
    sessionSecret: '',
    // Cloudflare Email Sending via REST API; in dev, emails log to the console
    cfAccountId: '',
    cfEmailToken: '',
    emailFrom: '',
    // absolute origin for emailed links and the Origin check on API writes;
    // defaults to the request origin in dev, REQUIRED in production
    appOrigin: '',
    // comma-separated emails that see the feedback inbox and get notified
    // when feedback arrives (NUXT_ADMIN_EMAILS). Nobody is admin until set.
    adminEmails: '',
    // NUXT_TRUST_PROXY=1 when self-hosting behind a reverse proxy that sets
    // X-Forwarded-For (Cloudflare needs nothing — cf-connecting-ip is used)
    trustProxy: '',
    // sign-up ceiling (NUXT_MAX_USERS); keeps a public instance's D1/email
    // spend bounded
    maxUsers: '250',
    // Cloudflare Turnstile secret (NUXT_TURNSTILE_SECRET_KEY). With the
    // public site key below, the sign-in form gets a bot check.
    turnstileSecretKey: '',
    // Sign in through Authrr (see "Accounts through Authrr" in the README):
    // the client id and secret from Authrr's Apps page. Only used when
    // NUXT_PUBLIC_AUTHRR_ISSUER below is set.
    authrrClientId: '',
    authrrClientSecret: '',
    public: {
      // NUXT_PUBLIC_AUTHRR_ISSUER — Authrr's origin. Set, and this app's own
      // magic links and passkeys switch off in favour of Authrr's.
      authrrIssuer: '',
      // NUXT_PUBLIC_TURNSTILE_SITE_KEY — empty disables the widget
      turnstileSiteKey: ''
    }
  },

  compatibilityDate: '2025-07-15',

  nitro: {
    // Worker name for the Cloudflare build (otherwise nitro invents one).
    // NUXT_CF_AUTHRR_SERVICE names the Authrr worker for a service binding,
    // so calls to it skip the public internet (and Cloudflare's same-zone
    // fetch restrictions). See server/utils/authrr.ts.
    cloudflare: {
      wrangler: {
        name: process.env.NUXT_CF_WORKER_NAME || APP_SLUG,
        // Served only at NUXT_APP_ORIGIN. The *.workers.dev address (and
        // per-version preview URLs) would be a second origin that the Origin
        // check, the passkey domain and Authrr's redirect URI disagree with.
        workers_dev: false,
        preview_urls: false,
        // The custom domain follows NUXT_APP_ORIGIN, so the deploy can't
        // drift from the domain passkeys are bound to.
        ...customDomainRoutes(process.env.NUXT_APP_ORIGIN),
        ...(process.env.NUXT_CF_AUTHRR_SERVICE
          ? { services: [{ binding: 'AUTHRR', service: process.env.NUXT_CF_AUTHRR_SERVICE }] }
          : {})
      }
    },
    // Nitro tree-shakes every package import it isn't told has side effects.
    // @simplewebauthn/server imports reflect-metadata purely for its Reflect
    // polyfill, which tsyringe (via @peculiar/x509) checks for at load time —
    // dropped, the production worker throws before serving a single request.
    // Dev runs unbundled, so only a production build shows it.
    moduleSideEffects: ['reflect-metadata/']
  },

  hub: {
    // Local storage in dev. The e2e suite points HUB_DIR elsewhere so its
    // accounts stay out of the database `make up` uses (see tests/e2e).
    dir: process.env.HUB_DIR || '.data',
    cache: true,
    db: 'sqlite',
    kv: true,
    // R2 — stores uploaded profile pictures (see server/api/account/avatar).
    blob: true
  },

  eslint: { config: { stylistic: true } },

  // Icons ship in the bundle (no runtime calls to the Iconify API).
  icon: {
    serverBundle: 'local',
    clientBundle: { scan: true, sizeLimitKb: 256 }
  }
})
