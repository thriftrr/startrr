<script setup lang="ts">
import { APP_NAME } from '#shared/app'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const { refresh } = useAuth()
const state = ref<'working' | 'offer' | 'error'>('working')
const message = ref('')
const next = ref('/')
const adding = ref(false)

useHead({ title: computed(() => state.value === 'offer' ? 'Add a passkey' : 'Signing in…') })

onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string' || !token) {
    state.value = 'error'
    message.value = 'This link is missing its token.'
    return
  }
  try {
    const result = await $fetch<{ passkeys: number }>('/api/auth/verify', { method: 'POST', body: { token } })
    await refresh()
    next.value = safeRedirectPath(route.query.redirect) || takeAfterLogin() || '/'
    // The email is proven; now is the moment to offer the faster way in —
    // once per browser, only to accounts with no passkey yet, and only on a
    // device that can hold one without a QR code or a security key.
    if (!result.passkeys && !passkeyOfferDismissed() && await passkeyDeviceAvailable()) {
      state.value = 'offer'
      return
    }
    await navigateTo(next.value)
  } catch (cause: unknown) {
    const err = cause as { data?: { statusMessage?: string } }
    state.value = 'error'
    message.value = err.data?.statusMessage ?? 'Could not verify this link.'
  }
})

async function add () {
  if (adding.value) return
  adding.value = true
  message.value = ''
  try {
    await addPasskey()
    await navigateTo(next.value)
  } catch (cause: unknown) {
    message.value = passkeyErrorMessage(cause, 'No passkey was saved. Try again, or skip it for now.')
  } finally {
    adding.value = false
  }
}

async function skip () {
  dismissPasskeyOffer()
  await navigateTo(next.value)
}
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
      <template v-else-if="state === 'offer'">
        <Icon
          name="lucide:fingerprint"
          size="30"
          class="offer-icon"
          aria-hidden="true"
        />
        <h1>You're in. Skip the email next time?</h1>
        <p class="y-body offer-copy">
          Add a passkey and sign in with your fingerprint, face, or screen lock.
          Email links keep working too.
        </p>
        <div class="offer-actions">
          <button
            class="y-btn add"
            :disabled="adding"
            @click="add"
          >
            {{ adding ? 'Waiting for your device…' : 'Add a passkey' }}
          </button>
          <button
            class="y-btn-link"
            :disabled="adding"
            @click="skip"
          >
            Not now
          </button>
        </div>
        <p
          v-if="message"
          class="y-error msg"
          role="alert"
        >
          {{ message }}
        </p>
        <p class="later">
          You can add or remove passkeys any time on your account page.
        </p>
      </template>
      <template v-else>
        <h1>That link didn't work</h1>
        <p
          class="y-error msg"
          role="alert"
        >
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

.offer-icon { color: var(--teal); }
.offer-icon + h1 { margin-top: 8px; }
.offer-copy { margin: 8px 0 0; }
.offer-actions {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.add { width: 100%; padding: 11px 13px; font-size: 14px; }
.later { margin: 16px 0 0; font-size: 12.5px; color: var(--fg-muted); }
</style>
