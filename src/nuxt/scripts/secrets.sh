#!/usr/bin/env bash
# Push the secret half of .env to the deployed worker (run once, and again
# whenever one of them changes). Values never appear on the command line.
#   make secrets
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "✘ src/nuxt/.env not found (copy .env.example)"; exit 1; }
get () { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
export CLOUDFLARE_ACCOUNT_ID="$(get NUXT_CF_ACCOUNT_ID)"
WORKER_NAME="$(get NUXT_CF_WORKER_NAME)"; WORKER_NAME="${WORKER_NAME:-startrr}"
[ -n "$CLOUDFLARE_ACCOUNT_ID" ] || { echo "✘ NUXT_CF_ACCOUNT_ID missing in .env"; exit 1; }
session="$(get NUXT_SESSION_SECRET)"
if [ -z "$session" ]; then
  echo "✘ NUXT_SESSION_SECRET is empty in .env — generate one: openssl rand -base64 32"
  exit 1
fi
for key in NUXT_SESSION_SECRET NUXT_CF_EMAIL_TOKEN NUXT_TURNSTILE_SECRET_KEY; do
  val="$(get "$key")"
  if [ -n "$val" ]; then
    printf '%s' "$val" | npx wrangler secret put "$key" --name "$WORKER_NAME"
  else
    echo "· $key empty in .env — skipped"
  fi
done
echo "✔ secrets pushed to $WORKER_NAME"
