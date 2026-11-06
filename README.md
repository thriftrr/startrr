# Startrr

A starting place for a simple web app. Nuxt 4 + [NuxtHub](https://hub.nuxt.com/)
on a single Cloudflare Worker (D1, KV, R2), with the parts every small app
needs already built and hardened:

- **Passwordless accounts** — standalone, or through
[Authrr](#accounts-through-authrr) for one sign-in across apps. Magic links (15-minute, single-use, only the
  SHA-256 digest stored) to prove an email, then passkeys for one-tap sign-in
  after that; sessions as signed JWTs that name a revocable row, and a "sign
  out everywhere else" button that actually works.
- **Profiles** — first/last name, an uploaded photo (R2) with Gravatar and
  initials as fallbacks, and seven colour palettes that re-tint the whole app.
- **A first-visit walkthrough** — the home page walks a new person through
  their profile, then gets out of the way.
- **A feedback inbox** — floating button, Markdown editor, admin page,
  notification email. Compiled out entirely with one env var.
- **Hardening** — per-request CSP nonces with `strict-dynamic`, an Origin
  check on every API write, KV-backed rate limits, body-size caps, optional
  Cloudflare Turnstile on the sign-in form, and a sign-up ceiling so a public
  instance can't run up a bill.
- **Tooling** — ESLint, `vue-tsc`, Vitest (unit + a real end-to-end sign-in
  test), GitHub Actions, Dependabot.


## Start a new app

1. **Use this template** on GitHub, clone it, then name it:

   ```sh
   make rename NAME=Plannrr
   ```

   That rewrites every `startrr` / `Startrr` in the repo (package name,
   worker name, cookie name, storage keys, resource names). Then edit the
   tagline and description in [src/nuxt/shared/app.ts](src/nuxt/shared/app.ts),
   swap the two SVGs in [src/nuxt/public](src/nuxt/public), and rewrite this
   README.

2. Run it:

   ```sh
   make build
   cp src/nuxt/.env.example src/nuxt/.env   # nothing is required for dev
   make up
   ```

   Open http://localhost:3000. In dev the magic-link email prints to the
   server console and the link is shown on the sign-in page.

3. Build your thing. [src/nuxt/app/pages/scratch.vue](src/nuxt/app/pages/scratch.vue)
   and [src/nuxt/server/api/scratch](src/nuxt/server/api/scratch) are a
   deliberately tiny example feature (a per-user note in KV) showing the
   shape: a page, a shared type, two handlers with `requireUser`, validation,
   and a rate limit. Delete them when you've got the idea.

```sh
make check   # lint + typecheck + tests — what CI runs
```

## Layout

```
makefile                 build · up · check · test · rename · secrets · deploy
scripts/rename.sh        make rename NAME=…
src/nuxt/
  app/                   pages, components, composables, layouts, middleware
  server/routes/         auth/authrr (start, callback) — sign-in through Authrr
  server/api/            auth, account, scratch (example)
  server/utils/          session, auth-db, passkeys, authrr, rate-limit, email, turnstile, origin
  server/middleware/     security headers + CSP nonce, origin check, body limit
  server/plugins/        csp-nonce (stamps the nonce onto rendered scripts)
  server/db/schema.ts    users, login_tokens, sessions, passkeys, feedback
  shared/                app.ts (brand), types used on both sides
  modules/feedback/      the feedback feature as a local Nuxt module
  tests/unit, tests/e2e  vitest
  scripts/               deploy.sh, secrets.sh
```

Structure mirrors Plannrr / hivrr `v0`: root `makefile`, app in `src/nuxt`.

## Accounts

Sign-in is passwordless. Every account starts with an email: enter one, get
a magic link, and owning the inbox is the proof. Right after that first
link, a device that can hold a passkey offers to make one ("Not now" is
remembered per browser), and the account page adds and removes them any
time. From then on the sign-in page offers passkeys in the email field's
autofill and behind a "Sign in with a passkey" button. The email link always
works too, so removing every passkey never locks anyone out.

Passkeys are discoverable WebAuthn credentials, verified with
[SimpleWebAuthn](https://simplewebauthn.dev). Sign-in sends no email address
first, so it reveals nothing about which accounts exist. Challenges are
handed out signed and stateless, so showing the sign-in page writes nothing,
and each is recorded as spent when used, so a response can't be replayed.

Sessions are JWTs in an httpOnly, SameSite=Lax cookie, each naming a row in
`sessions`; logging out deletes the row, so the cookie is dead immediately.
The account page lists every signed-in browser and can revoke all the
others.

`NUXT_ADMIN_EMAILS` (comma-separated) decides who is admin — there is no role
column. Admins see the feedback inbox and get feedback notifications.

Storage is NuxtHub: drizzle over SQLite/D1 ([server/db/schema.ts](src/nuxt/server/db/schema.ts),
migrations via `npx nuxt db generate`), KV for rate-limit counters and the
example note, R2 for profile pictures.

## Accounts through Authrr

[Authrr](https://github.com/thriftrr/authrr) is the thriftrr identity
provider: one account and one passkey across every app built on this
template. Point an app at it and that app's own magic links and passkeys
switch off. People stay on the app throughout: `/login` shows a "Sign in
with thriftrr" button that opens Authrr in a small window, and the page
carries on signed in once it closes (if they were already signed in to
Authrr, it just flashes). An emailed link opened in another tab finishes
the sign-in in the window that's waiting. Popups blocked, it's a plain
redirect instead.

1. In Authrr, **Apps → Register an app**, with
   `<NUXT_APP_ORIGIN>/auth/authrr/callback` as the redirect URI. It shows
   the client secret once.
2. In this app's `src/nuxt/.env`:

   ```sh
   NUXT_PUBLIC_AUTHRR_ISSUER=https://authrr.thriftrr.biz
   NUXT_AUTHRR_CLIENT_ID=startrr
   NUXT_AUTHRR_CLIENT_SECRET=…
   NUXT_CF_AUTHRR_SERVICE=authrr   # the Authrr worker's name (Cloudflare)
   ```

3. `make secrets && make deploy`.

What changes:

- **Who someone is** comes from Authrr's ID token. The local `users` row is
  kept (everything the app stores still hangs off its id) and linked by
  Authrr's `sub`; the first time, an existing account with the same email
  is adopted, so switching an app over keeps everyone's data.
- **Sessions stay local** — the same revocable 30-day cookie — but the
  hourly refresh also asks Authrr whether the person is still allowed in
  and copies their name, photo and role. A ban there ends the session here
  within the hour. If Authrr can't be reached, the session stands and the
  question is asked again on the next request.
- **Admin** is `NUXT_ADMIN_EMAILS` *or* the `admin` role Authrr gives on
  this app.
- **The account page** shows the profile read-only with a link to edit it
  in Authrr; the passkeys card goes (passkeys live there). Palettes and the
  signed-in browsers list stay.
- **Sign out** goes through Authrr's logout, so the next sign-in actually
  asks — otherwise `/login` would send you straight back in.
- **`NUXT_CF_AUTHRR_SERVICE`** adds a service binding, so calls to Authrr
  (code exchange, keys, session checks) go worker-to-worker instead of over
  the internet — Cloudflare doesn't always let a Worker fetch another
  Worker's domain in the same zone.

Leave `NUXT_PUBLIC_AUTHRR_ISSUER` empty and nothing here applies.

## Feedback module

The floating Feedback button, its Markdown editor (TipTap), the admin inbox
at `/admin/feedback`, the `/api/feedback` routes, and the notification email
live in [src/nuxt/modules/feedback](src/nuxt/modules/feedback). Set
`NUXT_FEATURE_FEEDBACK=0` at **build** time to compile all of it out — the
routes don't exist, TipTap isn't in the bundle, and the layout's
`<FeedbackFab />` becomes an empty stub. (The `feedback` table stays in the
schema either way; an empty table costs nothing and keeps migrations linear.)

## Email (Cloudflare Email Sending)

Magic links and feedback notifications send through
[Cloudflare Email Sending](https://developers.cloudflare.com/email-service/):
the Workers `send_email` binding when deployed, or the REST API via
`NUXT_CF_ACCOUNT_ID` + `NUXT_CF_EMAIL_TOKEN` + `NUXT_EMAIL_FROM`. The from-
domain must be onboarded first (`npx wrangler email sending enable <domain>`).
Without any transport configured, dev logs the email and production refuses
to send (fail closed).

## Turnstile (optional)

Create a widget at Cloudflare → Turnstile, then set
`NUXT_PUBLIC_TURNSTILE_SITE_KEY` and `NUXT_TURNSTILE_SECRET_KEY`. The sign-in
form renders the (interaction-only) widget and the server verifies the token
before sending a link. Leave both empty to skip it — the rate limits still
apply. Cloudflare's always-pass test keys are listed in `.env.example`.

## Deploying (Cloudflare Workers)

One Worker with D1 (database), two KV namespaces (rate limits/notes + cache),
and an R2 bucket (profile pictures). Everything is created in **your**
Cloudflare account; the repo carries no account ids.

1. `npx wrangler login` once, then `make setup`. It creates the D1
   database, both KV namespaces and the R2 bucket (startrr-db, startrr-kv,
   startrr-cache, startrr-blob) in your account and writes their ids into
   `src/nuxt/.env`, with your account id and a generated session secret.
   Re-running it is safe: anything already there is left alone.
2. Fill in what only you know — `make setup` lists it: `NUXT_APP_ORIGIN`,
   `NUXT_ADMIN_EMAILS`, and the email-sending settings above (plus the `NUXT_AUTHRR_*` values, if signing in through Authrr).
3. `make secrets` pushes the secret values (session secret, email token,
   Turnstile secret) to the worker. Run it again whenever one changes.
4. `make deploy` builds with the Cloudflare preset, applies pending D1
   migrations, and deploys. Non-secret settings ride along as worker vars on
   every deploy. The worker is served **only** at `NUXT_APP_ORIGIN`: that
   hostname becomes its custom domain (the zone has to be on your
   Cloudflare account), and the `*.workers.dev` address and version preview
   URLs are switched off.

To try the production build locally before deploying (real CSP, real
bindings emulated by wrangler):

```sh
cd src/nuxt
NITRO_PRESET=cloudflare_module NUXT_CF_D1_DATABASE_ID=local NUXT_CF_KV_ID=local NUXT_CF_KV_CACHE_ID=local NUXT_CF_R2_BUCKET=local npm run build
npx wrangler --cwd .output/server d1 migrations apply DB --local
npx wrangler --cwd .output dev --persist-to .output/server/.wrangler/state --var NUXT_SESSION_SECRET:dev --var NUXT_APP_ORIGIN:http://localhost:8787
```

## Security notes for self-hosters

- **Set `NUXT_APP_ORIGIN`.** Production refuses to send magic links without
  it, because a link built from the request's Host header could be pointed at
  an attacker's domain by a spoofed proxy request. The same value is what
  API writes check the browser's `Origin` header against, and its hostname
  is the domain every passkey is bound to: **move the app to a new domain
  and existing passkeys stop working** (people sign in by email and add new
  ones).
- **CSP.** Scripts run only with the per-request nonce
  ([server/middleware/security.ts](src/nuxt/server/middleware/security.ts));
  `'strict-dynamic'` lets those trusted scripts load their own chunks. Inline
  event handlers (`onclick="…"`) and `javascript:` links are therefore
  blocked — use Vue listeners. Styles keep `'unsafe-inline'` because Nuxt
  inlines scoped CSS and Vue binds `:style` everywhere. Add image hosts to
  `img-src` as you hotlink them.
- **Behind your own reverse proxy?** Set `NUXT_TRUST_PROXY=1` so rate limits
  key on `X-Forwarded-For`; leave it unset on Cloudflare, where the real
  address arrives in `cf-connecting-ip`.
- **Anyone can request a login email** for any address (capped per address,
  per day, and per IP; Turnstile on top if configured). `NUXT_MAX_USERS`
  bounds sign-ups; the magic-link sender is the one endpoint on a public
  instance that spends money.
- **Sessions are 30-day signed JWTs** bound to a server-side row. Logout and
  "sign out everywhere else" revoke rows; rotating `NUXT_SESSION_SECRET`
  (`make secrets`) invalidates every session at once.
- Uploads are bounded (1MB raster images), other API bodies at 2MB, and
  responses carry HSTS, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, and `Cross-Origin-Opener-Policy`.

## License

[MIT](LICENSE).
