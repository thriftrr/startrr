#!/usr/bin/env bash
# Boot the production worker locally and make a few real requests.
#   make smoke        (CI runs it after the build)
# A build alone can't show a bundle that throws on load or code that only
# breaks in the Workers runtime; this runs the worker in workerd through
# `wrangler dev`, against local D1/KV/R2 with placeholder ids. Nothing here
# touches your Cloudflare account or .env.
#
# It builds into .output, so don't run it beside `make up`: the production
# build rewrites NuxtHub's generated database package under node_modules
# (see scripts/README.md).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${SMOKE_PORT:-8788}"
ORIGIN="http://localhost:$PORT"
STATE="$(mktemp -d)"
LOG="$STATE/wrangler.log"
WRANGLER=""
trap '[ -n "$WRANGLER" ] && kill "$WRANGLER" 2>/dev/null; rm -rf "$STATE"' EXIT

fail () {
  echo "✘ $1"
  [ -f "$LOG" ] && { echo "── wrangler log"; tail -40 "$LOG"; }
  exit 1
}

echo "── build (cloudflare preset, placeholder resource ids)"
NITRO_PRESET=cloudflare_module NUXT_CF_D1_DATABASE_ID=local NUXT_CF_KV_ID=local \
  NUXT_CF_KV_CACHE_ID=local NUXT_CF_R2_BUCKET=local npm run build >"$STATE/build.log" 2>&1 \
  || { tail -40 "$STATE/build.log"; fail "build"; }

echo "── migrations into a throwaway local D1"
npx wrangler --cwd .output/server d1 migrations apply DB --local --persist-to "$STATE" >"$STATE/migrate.log" 2>&1 \
  || { tail -40 "$STATE/migrate.log"; fail "migrations"; }

echo "── wrangler dev on :$PORT"
npx wrangler --cwd .output dev --port "$PORT" --persist-to "$STATE" \
  --var "NUXT_SESSION_SECRET:smoke-test-only" --var "NUXT_APP_ORIGIN:$ORIGIN" >"$LOG" 2>&1 &
WRANGLER=$!

# curl retries refused connections while workerd starts, and 5xx answers
# (a worker that throws on load) until it gives up.
curl -sf --retry 30 --retry-connrefused --retry-delay 1 -o "$STATE/login.html" "$ORIGIN/login" \
  || fail "GET /login never answered 200"
grep -q 'autocomplete="username webauthn"' "$STATE/login.html" || fail "/login rendered without its sign-in form"

# A passkey challenge, then an answer from a credential nobody registered:
# the token has to verify, the challenge has to be spent in D1, and the rate
# limit has to count in KV before the worker can say "unknown passkey".
curl -sf -X POST -H "origin: $ORIGIN" -o "$STATE/options.json" "$ORIGIN/api/auth/passkey/options" \
  || fail "POST /api/auth/passkey/options"
token="$(node -p 'require(process.argv[1]).challengeToken' "$STATE/options.json")"
code="$(curl -s -X POST -H "origin: $ORIGIN" -H 'content-type: application/json' -o "$STATE/verify.json" -w '%{http_code}' \
  -d "{\"challengeToken\":\"$token\",\"response\":{\"id\":\"c21va2U\",\"type\":\"public-key\",\"response\":{}}}" \
  "$ORIGIN/api/auth/passkey/verify")"
[ "$code" = 400 ] && grep -q unknownCredential "$STATE/verify.json" \
  || fail "passkey verify answered $code: $(cat "$STATE/verify.json")"

echo "✔ the production worker boots and answers"
