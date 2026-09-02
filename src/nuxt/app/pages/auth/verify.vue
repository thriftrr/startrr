<script setup lang="ts">
import { APP_NAME } from '#shared/app'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Signing in…' })

const route = useRoute()
const { refresh } = useAuth()
const state = ref<'working' | 'error'>('working')
const message = ref('')

onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string' || !token) {
    state.value = 'error'
    message.value = 'This link is missing its token.'
    return
  }
  try {
    await $fetch('/api/auth/verify', { method: 'POST', body: { token } })
    await refresh()
    await navigateTo(safeRedirectPath(route.query.redirect) || takeAfterLogin() || '/')
  } catch (cause: unknown) {
    const err = cause as { data?: { statusMessage?: string } }
    state.value = 'error'
    message.value = err.data?.statusMessage ?? 'Could not verify this link.'
  }
})
</script>

<template>
  <main class="wrap">
    <NuxtLink
      to="/"
      class="y-wordmark mark"
    >{{ APP_NAME }}<span>.</span></NuxtLink>
    <section class="panel">
      <p
        v-if="state === 'working'"
        class="y-body"
      >
        Signing you in…
      </p>
      <template v-else>
        <h1>That link didn't work</h1>
        <p class="y-error msg">
          {{ message }}
        </p>
        <NuxtLink
          to="/login"
          class="again"
        >Request a new link</NuxtLink>
      </template>
    </section>
  </main>
</template>

<style scoped>
.wrap { display: flex; flex-direction: column; align-items: center; }
.mark { font-size: 26px; }
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
.msg { margin: 8px 0 0; font-size: 13.5px; }
.again { display: inline-block; margin-top: 14px; font-weight: 700; font-size: 13.5px; }
</style>
