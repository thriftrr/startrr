#!/usr/bin/env bash
# One-time Cloudflare setup — `make setup`.
#
# Creates this app's D1 database, KV namespaces and R2 bucket in your own
# account and writes their ids into .env, along with a fresh session secret
# (and, where the app has one, an OIDC signing key). Safe to re-run: anything
# already in .env, or already in your account, is left as it is.
#
# Prereq: `npx wrangler login` once. Then: make setup && make secrets && make deploy
set -euo pipefail
cd "$(dirname "$0")/.."

# Tests swap in a fake; everyone else gets the project's wrangler.
read -r -a WRANGLER <<<"${WRANGLER:-npx wrangler}"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "── made .env from .env.example"
fi

get () { grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true; }

# Sets KEY=value in .env: the first KEY= line is replaced, or one appended.
put () {
  node -e '
    const fs = require("fs")
    const [key, value] = process.argv.slice(1)
    const text = fs.readFileSync(".env", "utf8")
    const line = new RegExp(`^${key}=.*$`, "m")
    const next = line.test(text)
      ? text.replace(line, () => `${key}=${value}`)
      : `${text.replace(/\n?$/, "\n")}${key}=${value}\n`
    fs.writeFileSync(".env", next)
  ' "$1" "$2"
}

# The JSON in a command's output, minus any banner or warnings around it.
json_of () {
  node -e '
    const text = require("fs").readFileSync(0, "utf8")
    const open = text.search(/[[{]/)
    const close = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"))
    if (open < 0 || close < open) process.exit(1)
    process.stdout.write(JSON.stringify(JSON.parse(text.slice(open, close + 1))))
  '
}

# Prints the value of `field` on the entry of a JSON array whose `match`
# field equals `value`; nothing if there isn't one.
pick () {
  node -e '
    const [match, value, field] = process.argv.slice(1)
    const list = JSON.parse(require("fs").readFileSync(0, "utf8"))
    const hit = list.find(x => x[match] === value)
    if (hit) process.stdout.write(String(hit[field]))
  ' "$1" "$2" "$3"
}

# ---- Account ----------------------------------------------------------------
if ! who="$("${WRANGLER[@]}" whoami --json 2>/dev/null | json_of)"; then
  echo "✘ Not signed in to Cloudflare. Run: npx wrangler login"
  exit 1
fi
account="$(get NUXT_CF_ACCOUNT_ID)"
if [ -z "$account" ]; then
  count="$(node -p 'JSON.parse(process.argv[1]).accounts.length' "$who")"
  if [ "$count" != 1 ]; then
    echo "✘ You can use $count Cloudflare accounts. Put the one for this app in .env as NUXT_CF_ACCOUNT_ID:"
    node -e 'for (const a of JSON.parse(process.argv[1]).accounts) console.log(`    ${a.id}  ${a.name}`)' "$who"
    exit 1
  fi
  account="$(node -p 'JSON.parse(process.argv[1]).accounts[0].id' "$who")"
  put NUXT_CF_ACCOUNT_ID "$account"
  echo "✔ account $(node -p 'JSON.parse(process.argv[1]).accounts[0].name' "$who")"
fi
export CLOUDFLARE_ACCOUNT_ID="$account"

# ---- Names ------------------------------------------------------------------
slug="$(sed -n "s/^export const APP_SLUG = '\(.*\)'.*/\1/p" shared/app.ts)"
worker="$(get NUXT_CF_WORKER_NAME)"; worker="${worker:-$slug}"
db_name="$(get NUXT_CF_D1_DATABASE_NAME)"; db_name="${db_name:-$worker-db}"
bucket="$(get NUXT_CF_R2_BUCKET)"; bucket="${bucket:-$worker-blob}"
put NUXT_CF_WORKER_NAME "$worker"
put NUXT_CF_D1_DATABASE_NAME "$db_name"
put NUXT_CF_R2_BUCKET "$bucket"

# ---- D1 ---------------------------------------------------------------------
if [ -z "$(get NUXT_CF_D1_DATABASE_ID)" ]; then
  id="$("${WRANGLER[@]}" d1 list --json 2>/dev/null | json_of | pick name "$db_name" uuid || true)"
  if [ -z "$id" ]; then
    "${WRANGLER[@]}" d1 create "$db_name" >/dev/null
    id="$("${WRANGLER[@]}" d1 list --json 2>/dev/null | json_of | pick name "$db_name" uuid || true)"
  fi
  [ -n "$id" ] || { echo "✘ Created D1 $db_name but couldn't read its id back"; exit 1; }
  put NUXT_CF_D1_DATABASE_ID "$id"
fi
echo "✔ D1 $db_name"

# ---- KV -----------------------------------------------------------------------
kv () {
  local key="$1" title="$2" id
  if [ -z "$(get "$key")" ]; then
    id="$("${WRANGLER[@]}" kv namespace list 2>/dev/null | json_of | pick title "$title" id || true)"
    if [ -z "$id" ]; then
      "${WRANGLER[@]}" kv namespace create "$title" >/dev/null
      id="$("${WRANGLER[@]}" kv namespace list 2>/dev/null | json_of | pick title "$title" id || true)"
    fi
    [ -n "$id" ] || { echo "✘ Created KV $title but couldn't read its id back"; exit 1; }
    put "$key" "$id"
  fi
  echo "✔ KV $title"
}
kv NUXT_CF_KV_ID "$worker-kv"
kv NUXT_CF_KV_CACHE_ID "$worker-cache"

# ---- R2 -----------------------------------------------------------------------
# No id to record — only that it exists. "Already exists" is fine.
if ! out="$("${WRANGLER[@]}" r2 bucket create "$bucket" 2>&1)" && ! grep -qi "already exists" <<<"$out"; then
  echo "✘ Couldn't create R2 bucket $bucket:"; echo "$out" | tail -5; exit 1
fi
echo "✔ R2 $bucket"

# ---- Secrets ------------------------------------------------------------------
if [ -z "$(get NUXT_SESSION_SECRET)" ]; then
  put NUXT_SESSION_SECRET "$(node -p 'require("crypto").randomBytes(32).toString("base64")')"
  echo "✔ generated NUXT_SESSION_SECRET"
fi
# Only apps that sign tokens (Authrr) have this script and setting.
if [ -f scripts/oidc-key.mjs ] && grep -q '^NUXT_OIDC_SIGNING_KEY=' .env && [ -z "$(get NUXT_OIDC_SIGNING_KEY)" ]; then
  put NUXT_OIDC_SIGNING_KEY "$(node scripts/oidc-key.mjs | cut -d= -f2-)"
  echo "✔ generated NUXT_OIDC_SIGNING_KEY"
fi

# ---- What's left ------------------------------------------------------------------
# Only you know these. Email can wait (links print to the log until it's
# set), but deploy needs the origin.
todo=()
for key in NUXT_APP_ORIGIN NUXT_ADMIN_EMAILS NUXT_EMAIL_FROM NUXT_CF_EMAIL_TOKEN; do
  [ -n "$(get "$key")" ] || todo+=("$key")
done
if grep -qE '^NUXT_PUBLIC_AUTHRR_ISSUER=.+' .env; then
  for key in NUXT_AUTHRR_CLIENT_ID NUXT_AUTHRR_CLIENT_SECRET; do
    [ -n "$(get "$key")" ] || todo+=("$key")
  done
fi

echo
if [ ${#todo[@]} -gt 0 ]; then
  echo "Still to fill in .env: ${todo[*]}"
  echo "Then: make secrets && make deploy"
else
  echo "Ready: make secrets && make deploy"
fi
