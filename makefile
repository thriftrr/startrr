# Local development
# ------------------------------------
build:
	cd src/nuxt && npm i

up:
	cd src/nuxt && npm run dev

# Lint, typecheck, and tests — the same three checks CI runs.
check:
	cd src/nuxt && npm run lint && npm run typecheck && npm test

test:
	cd src/nuxt && npm test

# Boot the production worker in workerd (local D1/KV/R2) and make a few
# requests — catches a bundle that throws on load. Not beside `make up`.
smoke:
	cd src/nuxt && bash scripts/smoke.sh

# Rename the app (once, right after "Use this template"):
#   make rename NAME=Plannrr
rename:
	bash scripts/rename.sh "$(NAME)"

# Cloudflare deployment (see "Deploying" in README.md)
# ------------------------------------
# One-time: create the D1/KV/R2 resources, fill src/nuxt/.env, then `make secrets`.
# Create this app's D1/KV/R2 in your Cloudflare account and write their ids
# (and a session secret) into src/nuxt/.env. Safe to re-run.
setup:
	cd src/nuxt && bash scripts/setup.sh

secrets:
	cd src/nuxt && bash scripts/secrets.sh

# Build, apply D1 migrations, deploy the worker.
deploy:
	cd src/nuxt && bash scripts/deploy.sh

.PHONY: build up check test smoke rename setup secrets deploy
