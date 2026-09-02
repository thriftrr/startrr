<script setup lang="ts">
import { APP_NAME, APP_TAGLINE } from '#shared/app'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Sign in' })

const route = useRoute()
const { public: { turnstileSiteKey } } = useRuntimeConfig()

const email = ref('')
const sending = ref(false)
const sent = ref(false)
const error = ref('')
const devLink = ref('')
const turnstileToken = ref('')
const turnstile = ref<{ reset: () => void } | null>(null)

const redirect = computed(() => safeRedirectPath(route.query.redirect))
const canSend = computed(() => !sending.value && email.value.trim().length > 0 && (!turnstileSiteKey || turnstileToken.value))

async function submit () {
  if (!canSend.value) return
  sending.value = true
  error.value = ''
  try {
    const data = await $fetch<{ ok: boolean, devLink?: string }>('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, turnstile: turnstileToken.value || undefined }
    })
    sent.value = true
    devLink.value = data.devLink ?? ''
    rememberAfterLogin(redirect.value)
  } catch (cause: unknown) {
    const err = cause as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Something went wrong — try again.'
    // A Turnstile token is single-use; get a fresh one for the retry.
    turnstile.value?.reset()
  } finally {
    sending.value = false
  }
}

function reset () {
  sent.value = false
  devLink.value = ''
  turnstile.value?.reset()
}
</script>

<template>
  <main class="wrap">
    <NuxtLink
      to="/"
      class="y-wordmark mark"
    >{{ APP_NAME }}<span>.</span></NuxtLink>
    <div class="tagline">
      {{ APP_TAGLINE }}
    </div>

    <section
      v-if="!sent"
      class="panel"
    >
      <h1>Sign in with email</h1>
      <p class="y-body">
        No password — we'll email you a sign-in link that's valid for 15 minutes.
      </p>
      <!-- method="dialog": before hydration attaches the Vue handler, a native
           submit would GET /login and reload the page, wiping the form. A
           dialog-method form outside a <dialog> submits nowhere, and unlike an
           inline onsubmit="return false" it needs no CSP exception. -->
      <form
        method="dialog"
        @submit.prevent="submit"
      >
        <input
          v-model="email"
          class="y-input"
          type="email"
          required
          placeholder="you@example.com"
          aria-label="Email address"
          autocomplete="email"
        >
        <TurnstileWidget
          ref="turnstile"
          v-model="turnstileToken"
        />
        <button
          class="y-btn send"
          type="submit"
          :disabled="!canSend"
        >
          {{ sending ? 'Sending…' : 'Email me a link' }}
        </button>
      </form>
      <p
        v-if="error"
        class="y-error err"
      >
        {{ error }}
      </p>
    </section>

    <section
      v-else
      class="panel"
    >
      <h1>Check your email 📬</h1>
      <p class="y-body">
        We sent a sign-in link to <b>{{ email }}</b>. It expires in 15 minutes.
      </p>
      <div
        v-if="devLink"
        class="y-note dev"
      >
        Dev mode — the link is also in the server console:<br>
        <a
          :href="devLink"
          class="dev-url"
        >{{ devLink }}</a>
      </div>
      <button
        class="y-btn-link back"
        @click="reset"
      >
        ← Use a different email
      </button>
    </section>
  </main>
</template>

<style scoped>
.wrap { display: flex; flex-direction: column; align-items: center; }
.mark { font-size: 26px; }
.tagline { margin-top: 4px; font-size: 13.5px; color: var(--fg-subtle); }
.panel {
  margin-top: 28px;
  width: 400px;
  max-width: 100%;
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: var(--r-panel);
  padding: 28px;
  box-shadow: var(--shadow-card);
}
h1 { font-size: 18px; }
.panel p { margin: 8px 0 0; }
form { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
.send { padding: 11px 13px; font-size: 14px; }
.err { margin-top: 12px; font-size: 13.5px; }
.dev { margin-top: 14px; }
.dev-url { word-break: break-all; font-weight: 700; }
.back { margin-top: 14px; }
</style>
