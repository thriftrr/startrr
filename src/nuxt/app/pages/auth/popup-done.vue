<script setup lang="ts">
import { APP_NAME } from '#shared/app'

// Where a popup sign-in lands (see utils/authrr-popup.ts): tells the page
// that's waiting, then closes. Opened from an emailed link instead, it
// can't close itself — then it's an ordinary landing that carries on.
definePageMeta({ layout: 'auth' })
useHead({ title: 'Signing in' })

const route = useRoute()
const next = safeRedirectPath(route.query.next) || '/'
const error = typeof route.query.error === 'string' ? route.query.error : ''
const stuck = ref(false)

onMounted(() => {
  announceAuthrrResult(error ? { type: 'error', code: error } : { type: 'signed-in', next })
  window.close()
  // Still here: not a window we opened, so nothing will close it.
  setTimeout(() => {
    if (error) return navigateTo(`/login?${new URLSearchParams({ error })}`, { replace: true })
    stuck.value = true
  }, 400)
})
</script>

<template>
  <main class="wrap">
    <section
      class="panel"
      aria-live="polite"
    >
      <template v-if="!stuck">
        <p class="y-body">
          Signing you in to {{ APP_NAME }}…
        </p>
      </template>
      <template v-else>
        <h1>You're signed in</h1>
        <p class="y-body">
          If {{ APP_NAME }} is open in another tab, it's signed in there too —
          you can close this one.
        </p>
        <NuxtLink
          :to="next"
          class="y-btn go"
          replace
        >
          Continue here
        </NuxtLink>
      </template>
    </section>
  </main>
</template>

<style scoped>
.wrap { display: flex; flex-direction: column; align-items: center; }
.panel {
  margin-top: 28px;
  width: 400px;
  max-width: 100%;
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: var(--r-panel);
  padding: 28px;
  box-shadow: var(--shadow-card);
  text-align: center;
}
h1 { font-size: 18px; }
.panel p { margin: 8px 0 0; }
.go { margin-top: 18px; display: inline-flex; text-decoration: none; }
</style>
