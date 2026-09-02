import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The e2e suite boots a real dev server; give it room.
    testTimeout: 60_000,
    hookTimeout: 120_000
  }
})
