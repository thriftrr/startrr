<script setup lang="ts">
// Cloudflare Turnstile, client side. Renders nothing until
// NUXT_PUBLIC_TURNSTILE_SITE_KEY is set; with it, loads Cloudflare's script
// once and hands the token up through v-model. The server checks it in
// server/utils/turnstile.ts.
interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [token: string] }>()

const { public: { turnstileSiteKey } } = useRuntimeConfig()
const host = ref<HTMLElement>()
let widgetId: string | null = null

const api = () => (globalThis as { turnstile?: TurnstileApi }).turnstile

function render () {
  const turnstile = api()
  if (!turnstile || !host.value || widgetId) return
  widgetId = turnstile.render(host.value, {
    'sitekey': turnstileSiteKey,
    'appearance': 'interaction-only',
    'callback': (token: string) => emit('update:modelValue', token),
    'expired-callback': () => emit('update:modelValue', ''),
    'error-callback': () => emit('update:modelValue', '')
  })
}

function reset () {
  const turnstile = api()
  if (turnstile && widgetId) turnstile.reset(widgetId)
  emit('update:modelValue', '')
}

onMounted(() => {
  if (!turnstileSiteKey) return
  if (api()) return render()
  let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
  if (!script) {
    script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }
  script.addEventListener('load', render, { once: true })
})

onBeforeUnmount(() => {
  const turnstile = api()
  if (turnstile && widgetId) turnstile.remove(widgetId)
  widgetId = null
})

defineExpose({ reset })
</script>

<template>
  <div
    v-if="turnstileSiteKey"
    ref="host"
    class="turnstile"
  />
</template>

<style scoped>
.turnstile:empty { display: none; }
</style>
