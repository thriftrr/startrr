<script setup lang="ts">
import { APP_NAME, APP_SLUG } from '#shared/app'
import { DEFAULT_PALETTE, PALETTE_IDS } from '#shared/types/palette'

const { palette } = usePalette()

// Function title templates can't ride in nuxt.config (not serializable) —
// they live here so "Account" becomes "Account · Startrr" on every page.
useHead({
  titleTemplate: (title?: string | null) =>
    title && title !== APP_NAME ? `${title} · ${APP_NAME}` : APP_NAME,
  htmlAttrs: {
    'data-palette': computed(() => palette.value === DEFAULT_PALETTE ? undefined : palette.value)
  },
  script: [{
    // Stamps the remembered palette before first paint so a reload never
    // flashes the default. Only known ids are honored. (Gets the CSP nonce
    // from server/plugins/csp-nonce.ts like every other inline script.)
    key: 'palette-boot',
    innerHTML: `(function(){try{var p=localStorage.getItem('${APP_SLUG}:palette');if(p&&${JSON.stringify(PALETTE_IDS)}.indexOf(p)>=0)document.documentElement.setAttribute('data-palette',p)}catch(e){}})()`
  }]
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
