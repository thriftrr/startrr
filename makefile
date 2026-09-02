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

# Rename the app (once, right after "Use this template"):
#   make rename NAME=Plannrr
rename:
	bash scripts/rename.sh "$(NAME)"

# Cloudflare deployment (see "Deploying" in README.md)
# ------------------------------------
# One-time: create the D1/KV/R2 resources, fill src/nuxt/.env, then `make secrets`.
secrets:
	cd src/nuxt && bash scripts/secrets.sh

# Build, apply D1 migrations, deploy the worker.
deploy:
	cd src/nuxt && bash scripts/deploy.sh

.PHONY: build up check test rename secrets deploy
