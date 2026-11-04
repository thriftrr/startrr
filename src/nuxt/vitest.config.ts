import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Plain Vitest, not @nuxt/test-utils' config: that one loads Nuxt once per
// test project at startup, and each load wipes and rewrites
// .data/db/migrations — two at once crash the run before a test starts.
// Unit tests import pure modules and need no Nuxt; e2e boots its own server.
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~~': fileURLToPath(new URL('.', import.meta.url))
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The e2e suite boots a real dev server; give it room.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Each e2e file boots its own dev server, and every Nuxt boot rewrites
    // .data/db/migrations — side by side they trip over each other's files.
    fileParallelism: false
  }
})
