<script setup lang="ts">
import { SUPPORT_LABEL, SUPPORT_URL } from '#shared/app'
</script>

<template>
  <div
    v-if="SUPPORT_URL"
    class="foot"
  >
    Made with ☕ —
    <a
      :href="SUPPORT_URL"
      target="_blank"
      rel="noopener"
    >{{ SUPPORT_LABEL }}</a>
  </div>
</template>

<style scoped>
.foot {
  margin-top: 26px;
  text-align: center;
  font-size: 12px;
  color: var(--fg-faint);
}
.foot a { font-weight: 700; }
</style>
