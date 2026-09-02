#!/usr/bin/env bash
# Give the app its name. Run once, right after "Use this template":
#   make rename NAME=Plannrr
# Rewrites every "startrr" / "Startrr" / "STARTRR" in tracked text files —
# package name, worker name, cookie name, storage keys, resource names in
# .env.example, this script — so the next rename starts from the new name.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-}"
if ! [[ "$NAME" =~ ^[A-Za-z][A-Za-z0-9]*$ ]]; then
  echo "✘ usage: make rename NAME=Plannrr   (letters and digits, starting with a letter)"
  exit 1
fi

slug="$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]')"
title="$(printf '%s' "${NAME:0:1}" | tr '[:lower:]' '[:upper:]')${NAME:1}"
upper="$(printf '%s' "$NAME" | tr '[:lower:]' '[:upper:]')"

if [ "$slug" = "startrr" ]; then
  echo "· already named $title — nothing to do"
  exit 0
fi

count=0
while IFS= read -r file; do
  perl -pi -e "s/startrr/$slug/g; s/Startrr/$title/g; s/STARTRR/$upper/g" "$file"
  count=$((count + 1))
done < <(git ls-files -z | xargs -0 grep -Il -i 'startrr' -- 2>/dev/null || true)

echo "✔ renamed startrr → $title in $count files"
echo
echo "Next:"
echo "  · edit src/nuxt/shared/app.ts — tagline, description, support link"
echo "  · replace src/nuxt/public/favicon.svg and logo-mark-light.svg with your mark"
echo "  · rewrite README.md for your app"
echo "  · git add -A && git commit -m 'Rename to $title'"
