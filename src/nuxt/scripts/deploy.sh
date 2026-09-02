#!/usr/bin/env bash
# Deploy to Cloudflare Workers — your own account, your own resources.
#   make deploy        (or: npm run deploy)
# Reads everything from src/nuxt/.env (see .env.example, "Cloudflare deployment").
# Prereqs: `npx wrangler login` done once, and the D1/KV/R2 resources created.
set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env without executing it: only KEY=VALUE lines, values taken verbatim.
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
      *=*) key=${line%%=*}; val=${line#*=}
           # environment wins over .env, same as Nuxt's own dotenv handling
           [ -z "${!key:-}" ] && export "$key=$val" ;;
    esac
  done < .env
fi

missing=()
for key in NUXT_CF_ACCOUNT_ID NUXT_CF_D1_DATABASE_ID NUXT_CF_D1_DATABASE_NAME NUXT_CF_KV_ID NUXT_CF_KV_CACHE_ID NUXT_CF_R2_BUCKET NUXT_APP_ORIGIN; do
  [ -n "${!key:-}" ] || missing+=("$key")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "✘ Missing in .env: ${missing[*]}"
  echo "  See .env.example → 'Cloudflare deployment' for how to create each resource."
  exit 1
fi
export CLOUDFLARE_ACCOUNT_ID="$NUXT_CF_ACCOUNT_ID"
WORKER_NAME="${NUXT_CF_WORKER_NAME:-startrr}"

# Production needs a session secret; refuse to ship a worker that would 500.
if ! npx wrangler secret list --name "$WORKER_NAME" 2>/dev/null | grep -q '"NUXT_SESSION_SECRET"'; then
  echo "✘ The worker has no NUXT_SESSION_SECRET secret yet. Run: make secrets"
  exit 1
fi

echo "── build (cloudflare preset)"
NITRO_PRESET=cloudflare_module npm run build

echo "── patch database_name into the generated wrangler.json"
python3 - "$NUXT_CF_D1_DATABASE_NAME" <<'PY'
import json, pathlib, sys
p = pathlib.Path('.output/server/wrangler.json')
cfg = json.loads(p.read_text())
cfg['d1_databases'][0]['database_name'] = sys.argv[1]
p.write_text(json.dumps(cfg, indent=2))
PY

echo "── apply pending D1 migrations"
# NOTE: Cloudflare's D1 HTTP API throws transient internal errors (code 7500),
# hence the retries. Separately, wrangler's batch runner chokes on some
# drizzle-style files: if apply keeps failing on a real migration, run its
# statements individually with
# `wrangler d1 execute <db> --remote --command '…'` and INSERT its filename
# into _hub_migrations.
applied=0
for attempt in 1 2 3 4; do
  if npx wrangler --cwd .output/server d1 migrations apply DB --remote; then
    applied=1; break
  fi
  echo "…transient D1 API error, retrying ($attempt/4)"; sleep 10
done
[ "$applied" = 1 ] || { echo "✘ migrations could not be applied — NOT deploying"; exit 1; }

echo "── deploy"
# Non-secret runtime config rides along as plain vars; secrets come from
# `make secrets` and persist across deploys.
vars=()
for key in NUXT_ADMIN_EMAILS NUXT_EMAIL_FROM NUXT_APP_ORIGIN NUXT_CF_ACCOUNT_ID NUXT_MAX_USERS NUXT_PUBLIC_TURNSTILE_SITE_KEY; do
  [ -n "${!key:-}" ] && vars+=(--var "$key:${!key}")
done
npx wrangler --cwd .output deploy "${vars[@]}"
echo "✔ deployed $WORKER_NAME"
