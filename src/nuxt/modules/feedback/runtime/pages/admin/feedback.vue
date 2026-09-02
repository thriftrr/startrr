<script setup lang="ts">
// Admin-only inbox for feedback. The client redirect is a courtesy — the
// /api/feedback routes refuse anyone who isn't in NUXT_ADMIN_EMAILS.
import MarkdownIt from 'markdown-it'

interface FeedbackItem {
  id: string
  userId: string
  email: string
  name: string
  body: string
  page: string
  userAgent: string
  resolvedAt: string | null
  createdAt: string
}

const { user, loaded, refresh } = useAuth()
if (!loaded.value) await refresh()
if (!user.value?.isAdmin) {
  await navigateTo('/', { replace: true })
}

const { data, pending, error, refresh: reload } = await useFetch<{ feedback: FeedbackItem[] }>('/api/feedback', {
  headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
})

// html:false is the whole security story: user Markdown never becomes
// markup except through markdown-it's own renderer, which escapes raw tags.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
const defaultLink = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer nofollow')
  return defaultLink(tokens, idx, options, env, self)
}
const render = (body: string) => md.render(body)

const filter = ref<'open' | 'resolved' | 'all'>('open')
const items = computed(() => {
  const list = data.value?.feedback ?? []
  if (filter.value === 'open') return list.filter(f => !f.resolvedAt)
  if (filter.value === 'resolved') return list.filter(f => f.resolvedAt)
  return list
})
const openCount = computed(() => (data.value?.feedback ?? []).filter(f => !f.resolvedAt).length)

const busy = ref<string | null>(null)
const actionError = ref('')

async function toggleResolved (item: FeedbackItem) {
  busy.value = item.id
  actionError.value = ''
  try {
    await $fetch(`/api/feedback/${item.id}`, { method: 'PATCH', body: { resolved: !item.resolvedAt } })
    await reload()
  } catch (cause) {
    actionError.value = (cause as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Could not update.'
  } finally {
    busy.value = null
  }
}

const confirmDelete = ref<string | null>(null)
async function remove (item: FeedbackItem) {
  busy.value = item.id
  actionError.value = ''
  try {
    await $fetch(`/api/feedback/${item.id}`, { method: 'DELETE' })
    confirmDelete.value = null
    await reload()
  } catch (cause) {
    actionError.value = (cause as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Could not delete.'
  } finally {
    busy.value = null
  }
}

function when (iso: string) {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

useHead({ title: 'Feedback inbox' })
</script>

<template>
  <main class="page">
    <div class="top">
      <h1>Feedback inbox</h1>
      <span class="count">{{ openCount }} open</span>
      <div
        class="filters"
        role="tablist"
        aria-label="Filter"
      >
        <button
          v-for="f in (['open', 'resolved', 'all'] as const)"
          :key="f"
          class="chip"
          :class="{ on: filter === f }"
          role="tab"
          :aria-selected="filter === f"
          @click="filter = f"
        >
          {{ f }}
        </button>
      </div>
      <button
        class="y-btn-outline reload"
        :disabled="pending"
        @click="reload()"
      >
        ↻ Refresh
      </button>
    </div>
    <p class="lede">
      Everything sent through the floating Feedback button. Bodies are Markdown, rendered here with raw HTML disabled.
    </p>

    <p
      v-if="error"
      class="err"
    >
      Could not load feedback: {{ (error.data as { statusMessage?: string } | undefined)?.statusMessage ?? error.message }}
    </p>
    <p
      v-if="actionError"
      class="err"
    >
      {{ actionError }}
    </p>

    <p
      v-if="!pending && !items.length"
      class="empty"
    >
      {{ filter === 'open' ? 'Inbox zero. Nothing open right now.' : 'Nothing here.' }}
    </p>

    <article
      v-for="item in items"
      :key="item.id"
      class="card y-card"
      :class="{ resolved: item.resolvedAt }"
    >
      <header class="card-head">
        <div class="who">
          <span class="name">{{ item.name || '(no name)' }}</span>
          <a
            class="email"
            :href="`mailto:${item.email}`"
          >{{ item.email }}</a>
        </div>
        <div class="meta">
          <span :title="item.createdAt">{{ when(item.createdAt) }}</span>
          <span
            v-if="item.page"
            class="sep"
          >·</span>
          <code
            v-if="item.page"
            :title="item.page"
          >{{ item.page }}</code>
        </div>
      </header>

      <!-- markdown-it output with html:false — user tags are escaped, never rendered -->
      <!-- eslint-disable vue/no-v-html -->
      <div
        class="body md"
        v-html="render(item.body)"
      />
      <!-- eslint-enable vue/no-v-html -->

      <footer class="card-foot">
        <span
          v-if="item.userAgent"
          class="ua"
          :title="item.userAgent"
        >{{ item.userAgent }}</span>
        <div class="acts">
          <template v-if="confirmDelete === item.id">
            <span class="sure">Delete for good?</span>
            <button
              class="y-btn-danger small"
              :disabled="busy === item.id"
              @click="remove(item)"
            >
              Yes, delete
            </button>
            <button
              class="y-btn-secondary small"
              :disabled="busy === item.id"
              @click="confirmDelete = null"
            >
              Keep
            </button>
          </template>
          <template v-else>
            <button
              class="y-btn-secondary small"
              :disabled="busy === item.id"
              @click="confirmDelete = item.id"
            >
              Delete
            </button>
            <button
              class="small"
              :class="item.resolvedAt ? 'y-btn-outline' : 'y-btn'"
              :disabled="busy === item.id"
              @click="toggleResolved(item)"
            >
              {{ item.resolvedAt ? 'Reopen' : 'Mark resolved' }}
            </button>
          </template>
        </div>
      </footer>
    </article>

    <PageFooter />
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  min-width: 0;
  padding: 26px 32px 60px;
  max-width: 820px;
}
.top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
h1 { font-size: 26px; margin: 0; }
.count {
  font-size: 12px;
  font-weight: 800;
  padding: 3px 9px;
  border-radius: var(--r-pill);
  background: var(--teal-badge);
  color: var(--teal-dark);
}
.filters { display: flex; gap: 4px; margin-left: 6px; }
.chip {
  padding: 5px 11px;
  border: 1.5px solid var(--border);
  border-radius: var(--r-pill);
  background: var(--bg-card);
  color: var(--fg-muted);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 800;
  text-transform: capitalize;
  cursor: pointer;
}
.chip.on { background: var(--teal); border-color: var(--teal); color: #fff; }
.reload { margin-left: auto; }
.lede { margin: 10px 0 0; color: var(--fg-muted); font-size: 14px; line-height: 1.55; max-width: 620px; }
.err { margin-top: 16px; color: var(--danger); font-weight: 700; font-size: 13px; }
.empty { margin-top: 28px; color: var(--fg-faint); font-size: 14px; }

.card { margin-top: 16px; padding: 18px 20px; }
.card.resolved { opacity: 0.72; }
.card-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.who { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.name { font-weight: 800; font-size: 15px; }
.email { font-size: 12.5px; color: var(--teal-dark); text-decoration: none; }
.email:hover { text-decoration: underline; }
.meta { margin-left: auto; font-size: 12px; color: var(--fg-faint); display: flex; gap: 6px; align-items: baseline; }
.meta code { background: var(--bg-app); padding: 1px 5px; border-radius: 4px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: bottom; }

.body { margin-top: 12px; font-size: 14px; line-height: 1.55; overflow-wrap: anywhere; }
.body :deep(> * + *) { margin-top: 0.6em; }
.body :deep(p) { margin: 0; }
.body :deep(h1), .body :deep(h2) { font-size: 16px; font-weight: 800; margin: 0; }
.body :deep(h3), .body :deep(h4) { font-size: 14.5px; font-weight: 800; margin: 0; }
.body :deep(ul), .body :deep(ol) { margin: 0; padding-left: 22px; }
.body :deep(code) { background: var(--bg-app); border: 1px solid var(--border-soft); border-radius: 4px; padding: 1px 5px; font-size: 12.5px; }
.body :deep(pre) { background: var(--fg); color: var(--nav-fg); border-radius: 10px; padding: 12px 14px; font-size: 12.5px; overflow: auto; }
.body :deep(pre code) { background: none; border: none; padding: 0; color: inherit; }
.body :deep(blockquote) { margin: 0; padding-left: 12px; border-left: 3px solid var(--teal-border); color: var(--fg-muted); }
.body :deep(a) { color: var(--teal-dark); }
.body :deep(img) { display: none; }

.card-foot { margin-top: 14px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ua { font-size: 11px; color: var(--fg-faint); max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acts { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.sure { font-size: 12.5px; font-weight: 700; color: var(--danger); }
.small { padding: 7px 14px; font-size: 12.5px; }

@media (max-width: 700px) {
  .page { padding: 24px 18px 48px; }
}
</style>
