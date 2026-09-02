<script setup lang="ts">
// Floating "Feedback" button (bottom-right, every signed-in page) and the
// modal it opens. The body is authored in a WYSIWYG editor but travels as
// Markdown; the server stores it verbatim and only the admin inbox renders it.
const { user, loaded } = useAuth()
const route = useRoute()

const open = ref(false)
const name = ref('')
const body = ref('')
const sending = ref(false)
const sent = ref(false)
const error = ref('')
const editorRef = ref<{ focus: () => void } | null>(null)

// Only signed-in people can send (the API requires a session), so the button
// itself waits for the session to resolve and hides for open-access modes.
const canShow = computed(() => loaded.value && Boolean(user.value))

const suggestedName = computed(() => {
  const u = user.value
  if (!u) return ''
  const full = [u.firstName, u.lastName].map(part => part?.trim()).filter(Boolean).join(' ')
  return full || u.email.split('@')[0] || ''
})

function show () {
  if (!name.value) name.value = suggestedName.value
  sent.value = false
  error.value = ''
  open.value = true
  nextTick(() => editorRef.value?.focus())
}

function close () {
  if (sending.value) return
  open.value = false
}

const canSend = computed(() => !sending.value && name.value.trim().length > 0 && body.value.trim().length > 0)

async function send () {
  if (!canSend.value) return
  sending.value = true
  error.value = ''
  try {
    await $fetch('/api/feedback', {
      method: 'POST',
      body: { name: name.value.trim(), body: body.value, page: route.fullPath }
    })
    sent.value = true
    body.value = ''
    // Let the thank-you register, then tidy up.
    setTimeout(() => {
      if (sent.value) open.value = false
    }, 1800)
  } catch (cause) {
    const err = cause as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
    error.value = err?.data?.statusMessage ?? err?.statusMessage ?? err?.message ?? 'Could not send — try again.'
  } finally {
    sending.value = false
  }
}

function onKey (e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close()
}
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    v-if="canShow"
    class="fab-root"
  >
    <button
      class="fab"
      type="button"
      title="Send feedback or report a bug"
      @click="show"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M8 2l1.9 1.9M16 2l-1.9 1.9" />
        <path d="M9 7.5a3 3 0 0 1 6 0" />
        <rect
          x="7"
          y="7.5"
          width="10"
          height="13"
          rx="5"
        />
        <path d="M12 7.5v13M7 12H3M21 12h-4M7.3 16.5L4 18.5M16.7 16.5L20 18.5M7.6 9L4.5 7M16.4 9l3.1-2" />
      </svg>
      <span>Feedback</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="fb-overlay"
        @click="close"
      >
        <div
          class="fb-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fb-title"
          @click.stop
        >
          <div class="fb-head">
            <div>
              <div
                id="fb-title"
                class="fb-title"
              >
                Send feedback
              </div>
              <div class="fb-sub">
                Bugs, ideas, confusing bits — anything goes. It lands straight in the admin inbox.
              </div>
            </div>
            <button
              class="fb-x"
              type="button"
              aria-label="Close"
              :disabled="sending"
              @click="close"
            >
              ✕
            </button>
          </div>

          <div
            v-if="sent"
            class="fb-thanks"
            role="status"
          >
            <div class="fb-thanks-big">
              Thank you!
            </div>
            <div>Your note is on its way.</div>
          </div>

          <form
            v-else
            class="fb-form"
            @submit.prevent="send"
          >
            <label class="y-field">
              <span>Your name</span>
              <input
                v-model="name"
                type="text"
                maxlength="80"
                autocomplete="name"
                required
                :disabled="sending"
              >
            </label>

            <div class="fb-body-label">
              Feedback
            </div>
            <ClientOnly>
              <FeedbackEditor
                ref="editorRef"
                v-model="body"
                :disabled="sending"
              />
              <template #fallback>
                <textarea
                  v-model="body"
                  class="fb-fallback"
                  rows="7"
                  placeholder="What happened? What did you expect?"
                />
              </template>
            </ClientOnly>

            <div class="fb-meta">
              Sent as <strong>{{ user?.email }}</strong> from <code>{{ route.path }}</code>
            </div>

            <div
              v-if="error"
              class="fb-error"
              role="alert"
            >
              {{ error }}
            </div>

            <div class="fb-actions">
              <button
                type="button"
                class="y-btn-secondary"
                :disabled="sending"
                @click="close"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="y-btn"
                :disabled="!canSend"
              >
                {{ sending ? 'Sending…' : 'Send feedback' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 10px 13px;
  border: none;
  border-radius: var(--r-pill);
  background: var(--teal);
  color: #fff;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.2px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(18, 150, 139, 0.35), 0 1px 3px rgba(43, 42, 38, 0.2);
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
}
.fab:hover { background: var(--teal-dark); transform: translateY(-1px); box-shadow: 0 8px 22px rgba(18, 150, 139, 0.4), 0 1px 3px rgba(43, 42, 38, 0.2); }
.fab:focus-visible { outline: 3px solid var(--teal-border); outline-offset: 2px; }
.fab svg { display: block; flex: none; }

@media (max-width: 700px) {
  .fab { right: 14px; bottom: 14px; padding: 10px 13px; }
  .fab span { display: none; }
}
</style>

<style>
/* Teleported to <body>, so the modal can't use scoped styles. */
.fb-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(43, 42, 38, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.fb-modal {
  width: 600px;
  max-width: 100%;
  max-height: 90vh;
  overflow: auto;
  background: var(--bg-card);
  border-radius: var(--r-panel);
  padding: 24px;
  box-shadow: 0 12px 40px rgba(43, 42, 38, 0.3);
  font-family: var(--font);
  color: var(--fg);
}
.fb-head { display: flex; align-items: flex-start; gap: 12px; }
.fb-title { font-weight: 800; font-size: 18px; }
.fb-sub { margin-top: 3px; font-size: 13px; color: var(--fg-muted); line-height: 1.5; }
.fb-x {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--fg-subtle);
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  padding: 0;
  flex: none;
}
.fb-x:hover { color: var(--fg); }

.fb-form { margin-top: 18px; display: flex; flex-direction: column; gap: 12px; }
.fb-body-label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--fg-subtle);
  margin-bottom: -6px;
}
.fb-fallback {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 13px;
  border: 1.5px solid var(--border-input);
  border-radius: var(--r-field);
  font-family: var(--font);
  font-size: 14px;
  background: var(--bg-input);
  resize: vertical;
}
.fb-meta { font-size: 12px; color: var(--fg-muted); }
.fb-meta code { background: var(--bg-app); padding: 1px 5px; border-radius: 4px; }
.fb-error {
  padding: 9px 12px;
  border-radius: var(--r-sm);
  background: var(--danger-bg);
  color: var(--danger-dark);
  font-size: 13px;
  font-weight: 700;
}
.fb-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }

.fb-thanks {
  margin-top: 22px;
  padding: 28px 20px;
  border-radius: var(--r-card);
  background: var(--teal-bg);
  border: 1.5px solid var(--teal-border);
  text-align: center;
  color: var(--teal-dark);
  font-size: 14px;
}
.fb-thanks-big { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
</style>
