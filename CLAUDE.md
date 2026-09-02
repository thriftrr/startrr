# Startrr

A template for small, self-hosted web apps: Nuxt 4 + NuxtHub on a single
Cloudflare Worker (D1, KV, R2). Passwordless accounts, profiles, palettes, a
feedback inbox, and a hardening layer come built in. README.md is the full
story; this file is the short one for working in the repo.

## Layout

- `makefile` — `make build | up | check | test | rename | secrets | deploy`
- `src/nuxt/` — the app. Nuxt 4 layout: `app/` (pages, components,
  composables), `server/` (API, utils, middleware, plugins, db), `shared/`
  (types used on both sides, plus `app.ts` for the brand), `modules/feedback`
  (the feedback feature as a local module), `tests/`, `scripts/`.
- Auto-imports are on: `server/utils/*` exports are globals in server code
  (`requireUser`, `assertRateLimit`, `db`, `schema`, `kv`, `blob`, …);
  `app/composables/*` and `app/utils/*` likewise on the client.

## Conventions

- Style: 2 spaces, no semicolons, single quotes, `function name () {}`.
  `npm run lint:fix` settles arguments.
- Every API write: `requireUser` (or `requireAdmin`), validate the body with
  explicit bounds, `assertRateLimit` when the write costs money (email) or
  storage, throw `createError` with a human `statusMessage`.
- Schema changes: edit `server/db/schema.ts`, run `npx nuxt db generate`,
  commit the migration. Dev applies it on next start; `make deploy` applies
  it to D1.
- Brand strings come from `shared/app.ts`; never hard-code the app name.
- Comments explain why, not what. Keep the existing tone.

## Before you say it's done

```sh
make check        # lint + typecheck + unit and e2e tests
```

The e2e suite boots a dev server against `.data/`, so it needs no secrets.
