<script setup lang="ts">
import type { ScratchNote } from '#shared/types/scratch'

// Example feature. Everything a real page needs and nothing more: load on
// mount, save on demand, show errors from the API's statusMessage.
useHead({ title: 'Scratchpad' })

const text = ref('')
const savedText = ref('')
const updatedAt = ref<string | null>(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')

const dirty = computed(() => text.value !== savedText.value)

onMounted(async () => {
  try {
    const note = await $fetch<ScratchNote>('/api/scratch')
    text.value = note.text
    savedText.value = note.text
    updatedAt.value = note.updatedAt
  } catch (cause: unknown) {
    const err = cause as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Could not load your note.'
  } finally {
    loading.value = false
  }
})

async function save () {
  if (busy.value || !dirty.value) return
  busy.value = true
  error.value = ''
  try {
    const note = await $fetch<ScratchNote>('/api/scratch', { method: 'PUT', body: { text: text.value } })
    savedText.value = note.text
    updatedAt.value = note.updatedAt
  } catch (cause: unknown) {
    const err = cause as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Could not save.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="page">
    <header class="top">
      <h1>Scratchpad</h1>
      <span
        class="y-small status"
        role="status"
      >
        <template v-if="loading">Loading…</template>
        <template v-else-if="dirty">Unsaved changes</template>
        <template v-else-if="updatedAt">Saved {{ timeAgo(updatedAt) }}</template>
        <template v-else>Nothing saved yet</template>
      </span>
    </header>
    <p class="y-body lede">
      One note, just for you, stored in KV under your account. It's here to show
      the shape of a feature — a page, two API handlers, a shared type — not to
      stay. Delete it when you've got the idea.
    </p>

    <section class="y-card editor">
      <textarea
        v-model="text"
        class="y-input area"
        rows="14"
        maxlength="10000"
        placeholder="Anything at all…"
        aria-label="Scratchpad note"
        :disabled="loading"
        @keydown.meta.enter.prevent="save"
        @keydown.ctrl.enter.prevent="save"
      />
      <div class="row">
        <span class="y-tiny">{{ text.length.toLocaleString() }} / 10,000 · ⌘↩ saves</span>
        <button
          class="y-btn"
          :disabled="busy || !dirty"
          @click="save"
        >
          {{ busy ? 'Saving…' : 'Save' }}
        </button>
      </div>
      <p
        v-if="error"
        class="y-error msg"
      >
        {{ error }}
      </p>
    </section>

    <PageFooter />
  </main>
</template>

<style scoped>
.page { flex: 1; min-width: 0; padding: 40px 56px 60px; max-width: 820px; }
.top { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
h1 { font-size: 26px; }
.status { margin-left: auto; }
.lede { margin: 8px 0 0; max-width: 560px; }
.editor { margin-top: 20px; }
.area { width: 100%; resize: vertical; font-size: 14px; line-height: 1.55; display: block; }
.row { margin-top: 12px; display: flex; align-items: center; gap: 12px; }
.row .y-btn { margin-left: auto; }
.msg { margin: 10px 0 0; font-size: 12.5px; }

@media (max-width: 860px) {
  .page { padding: 32px 24px 48px; }
}
</style>
