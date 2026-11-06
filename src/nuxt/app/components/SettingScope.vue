<script setup lang="ts">
import { APP_NAME } from '#shared/app'
import type { SettingScope } from '#shared/types/settings'

// "All thriftrr apps" or "Just <this app>" for a setting kept in Authrr
// (server/utils/settings.ts). Shown only when accounts are Authrr's: an
// app running its own accounts has nowhere else for a setting to apply.
defineProps<{ label: string }>()
const scope = defineModel<SettingScope>({ required: true })
const name = useId()
</script>

<template>
  <fieldset class="scope">
    <legend class="y-tiny">
      {{ label }}
    </legend>
    <label>
      <input
        v-model="scope"
        type="radio"
        :name="name"
        value="global"
      >
      All thriftrr apps
    </label>
    <label>
      <input
        v-model="scope"
        type="radio"
        :name="name"
        value="app"
      >
      Just {{ APP_NAME }}
    </label>
  </fieldset>
</template>

<style scoped>
.scope { margin: 12px 0 0; padding: 0; border: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
legend { float: left; margin-right: 4px; font-weight: 800; color: var(--fg-muted); }
label { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; cursor: pointer; }
input { accent-color: var(--teal); width: 16px; height: 16px; }
</style>
