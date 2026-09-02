<script setup lang="ts">
import { PALETTES, DEFAULT_PALETTE } from '#shared/types/palette'

useHead({ title: 'Account' })

const { user, loaded, refresh, logout } = useAuth()

// ---- Profile ---------------------------------------------------------------
const firstName = ref('')
const lastName = ref('')
const profileBusy = ref(false)
const profileSaved = ref(false)
const profileError = ref('')

const avatarBusy = ref(false)
const avatarError = ref('')
const avatarFile = ref<HTMLInputElement>()
const { avatarUrl, initials, hasCustom: hasCustomAvatar, source: avatarSource } = useAvatar()

const MAX_AVATAR_BYTES = 1024 * 1024

function syncFromUser () {
  firstName.value = user.value?.firstName ?? ''
  lastName.value = user.value?.lastName ?? ''
}

onMounted(async () => {
  await refresh()
  // Signed-out visitors never reach this page — auth.global.ts redirects them.
  if (!user.value) return
  syncFromUser()
  await loadSessions()
})

async function saveProfile () {
  if (profileBusy.value) return
  profileBusy.value = true
  profileError.value = ''
  try {
    await $fetch('/api/account/profile', {
      method: 'PATCH',
      body: { firstName: firstName.value, lastName: lastName.value }
    })
    await refresh()
    syncFromUser()
    profileSaved.value = true
    setTimeout(() => {
      profileSaved.value = false
    }, 2400)
  } catch (cause: unknown) {
    const err = cause as { data?: { statusMessage?: string } }
    profileError.value = err.data?.statusMessage ?? 'Could not save your profile.'
  } finally {
    profileBusy.value = false
  }
}

function pickAvatar () {
  avatarError.value = ''
  avatarFile.value?.click()
}

async function onAvatarPicked () {
  const file = avatarFile.value?.files?.[0]
  if (!file || avatarBusy.value) return

  // Check the cap before spending an upload round trip on it.
  if (file.size > MAX_AVATAR_BYTES) {
    avatarError.value = `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 1MB.`
    if (avatarFile.value) avatarFile.value.value = ''
    return
  }

  avatarBusy.value = true
  avatarError.value = ''
  try {
    const body = new FormData()
    body.append('file', file)
    await $fetch('/api/account/avatar', { method: 'POST', body })
    await refresh()
  } catch (cause: unknown) {
    const err = cause as { data?: { statusMessage?: string } }
    avatarError.value = err.data?.statusMessage ?? 'Could not upload that image.'
  } finally {
    if (avatarFile.value) avatarFile.value.value = ''
    avatarBusy.value = false
  }
}

async function resetAvatar () {
  if (avatarBusy.value) return
  avatarBusy.value = true
  avatarError.value = ''
  try {
    await $fetch('/api/account/avatar', { method: 'DELETE' })
    await refresh()
  } finally {
    avatarBusy.value = false
  }
}

// ---- Colour palette ----------------------------------------------------------
const { palette, save: savePalette } = usePalette()
const paletteBusy = ref(false)
const paletteError = ref('')
const paletteSavedAs = ref('')

async function choosePalette (id: string) {
  if (paletteBusy.value) return
  paletteBusy.value = true
  paletteError.value = ''
  try {
    await savePalette(id)
    paletteSavedAs.value = id
    setTimeout(() => {
      if (paletteSavedAs.value === id) paletteSavedAs.value = ''
    }, 2000)
  } catch (cause: unknown) {
    const err = cause as { data?: { statusMessage?: string } }
    paletteError.value = err.data?.statusMessage ?? 'Could not save that palette — it applies for now anyway.'
  } finally {
    paletteBusy.value = false
  }
}

// ---- Sessions ------------------------------------------------------------------
interface SessionItem {
  id: string
  current: boolean
  userAgent: string
  createdAt: string
  lastSeenAt: string
}

const sessions = ref<SessionItem[]>([])
const sessionsBusy = ref(false)
const sessionsMessage = ref('')
const confirmRevoke = ref(false)

const otherSessions = computed(() => sessions.value.filter(s => !s.current))

async function loadSessions () {
  try {
    const data = await $fetch<{ sessions: SessionItem[] }>('/api/auth/sessions')
    sessions.value = data.sessions
  } catch { /* the card shows an empty list */ }
}

// "Chrome on macOS" from a user-agent string — a label, not a fingerprint.
function describeUa (ua: string): string {
  if (!ua) return 'Unknown browser'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser'
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return os ? `${browser} on ${os}` : browser
}

async function revokeOthers () {
  if (sessionsBusy.value) return
  sessionsBusy.value = true
  sessionsMessage.value = ''
  try {
    const res = await $fetch<{ revoked: number }>('/api/auth/logout-others', { method: 'POST' })
    sessionsMessage.value = res.revoked
      ? `Signed out of ${res.revoked} other ${res.revoked === 1 ? 'browser' : 'browsers'}.`
      : 'No other browsers were signed in.'
    confirmRevoke.value = false
    await loadSessions()
  } catch (cause: unknown) {
    const err = cause as { data?: { statusMessage?: string } }
    sessionsMessage.value = err.data?.statusMessage ?? 'Could not sign out other browsers.'
  } finally {
    sessionsBusy.value = false
  }
}

async function signOut () {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <main class="page">
    <header class="top">
      <h1>Account</h1>
      <span
        v-if="user"
        class="who"
      >{{ user.email }}</span>
      <button
        v-if="user"
        class="y-btn-secondary out"
        @click="signOut"
      >
        Sign out
      </button>
    </header>

    <p
      v-if="!loaded"
      class="y-body loading"
    >
      Loading…
    </p>

    <template v-else-if="user">
      <section
        id="profile"
        class="y-card"
      >
        <div class="y-card-title">
          Profile
        </div>
        <div class="profile-body">
          <div class="avatar-col">
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              alt="Profile picture"
              width="84"
              height="84"
              class="avatar"
            >
            <span
              v-else
              class="avatar initials"
            >{{ initials }}</span>
            <span
              class="src"
              :class="{ custom: hasCustomAvatar }"
            >{{ avatarSource }}</span>
          </div>

          <div class="profile-fields">
            <p class="hint">
              Pulled automatically from <b>Gravatar</b> for {{ user.email }}. Upload your own
              to override it — or change it for every app at
              <a
                href="https://gravatar.com"
                target="_blank"
                rel="noopener"
              >gravatar.com</a>.
            </p>

            <div class="grid">
              <label class="y-field">First name
                <input
                  v-model="firstName"
                  type="text"
                  autocomplete="given-name"
                  maxlength="60"
                >
              </label>
              <label class="y-field">Last name
                <input
                  v-model="lastName"
                  type="text"
                  autocomplete="family-name"
                  maxlength="60"
                >
              </label>
              <label class="y-field wide">Email
                <input
                  type="email"
                  :value="user.email"
                  disabled
                  title="Sign-in email — change it by signing in with a new address"
                >
              </label>
            </div>

            <div class="actions">
              <input
                ref="avatarFile"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                class="hidden-file"
                aria-label="Profile picture"
                @change="onAvatarPicked"
              >
              <button
                class="y-btn-dashed"
                :disabled="avatarBusy"
                @click="pickAvatar"
              >
                {{ avatarBusy ? 'Uploading…' : hasCustomAvatar ? 'Replace photo…' : 'Upload a photo…' }}
              </button>
              <button
                v-if="hasCustomAvatar"
                class="y-btn-link"
                :disabled="avatarBusy"
                @click="resetAvatar"
              >
                Use Gravatar again
              </button>
              <button
                class="y-btn save"
                :disabled="profileBusy"
                @click="saveProfile"
              >
                {{ profileSaved ? 'Saved ✓' : profileBusy ? 'Saving…' : 'Save profile' }}
              </button>
            </div>
            <p class="y-tiny fine">
              PNG, JPEG, WebP, or GIF — up to 1MB.
            </p>
            <p
              v-if="avatarError"
              class="y-error msg"
            >
              {{ avatarError }}
            </p>
            <p
              v-if="profileError"
              class="y-error msg"
            >
              {{ profileError }}
            </p>
          </div>
        </div>
      </section>

      <section
        id="palette"
        class="y-card"
      >
        <div class="head-row">
          <div class="y-card-title">
            Colour palette
          </div>
          <span
            v-if="paletteSavedAs"
            class="y-badge"
          >Saved ✓</span>
        </div>
        <p class="y-body">
          The whole app re-tints — sidebar, buttons, links, badges. Pick the one that feels like yours.
        </p>
        <div
          class="palettes"
          role="radiogroup"
          aria-label="Colour palette"
        >
          <button
            v-for="p in PALETTES"
            :key="p.id"
            type="button"
            class="swatch"
            :class="{ on: palette === p.id }"
            role="radio"
            :aria-checked="palette === p.id"
            :disabled="paletteBusy"
            @click="choosePalette(p.id)"
          >
            <span
              class="swatch-art"
              :style="{ background: p.ground }"
            >
              <span
                class="swatch-bar"
                :style="{ background: p.sidebar }"
              />
              <span
                class="swatch-dot"
                :style="{ background: p.accent }"
              />
              <span
                class="swatch-line"
                :style="{ background: p.accent }"
              />
            </span>
            <span class="swatch-name">{{ p.name }}<template v-if="p.id === DEFAULT_PALETTE"> · default</template></span>
          </button>
        </div>
        <p
          v-if="paletteError"
          class="y-error msg"
        >
          {{ paletteError }}
        </p>
      </section>

      <section
        id="sessions"
        class="y-card"
      >
        <div class="head-row">
          <div class="y-card-title">
            Where you're signed in
          </div>
          <span class="y-pill y-pill-neutral">{{ sessions.length }} {{ sessions.length === 1 ? 'browser' : 'browsers' }}</span>
        </div>
        <p class="y-body">
          Every browser holding a sign-in link for this account. Signing out
          elsewhere revokes those sessions on the server — the cookies stop
          working immediately, not when they expire.
        </p>
        <ul class="session-list">
          <li
            v-for="s in sessions"
            :key="s.id"
            class="session-row"
          >
            <Icon
              :name="s.current ? 'lucide:monitor-check' : 'lucide:monitor'"
              size="18"
              aria-hidden="true"
            />
            <span class="session-name">{{ describeUa(s.userAgent) }}</span>
            <span
              v-if="s.current"
              class="y-badge"
            >This browser</span>
            <span class="y-small session-meta">
              signed in {{ timeAgo(s.createdAt) || 'just now' }}
              <template v-if="!s.current"> · last seen {{ timeAgo(s.lastSeenAt) || 'just now' }}</template>
            </span>
          </li>
        </ul>
        <div class="row">
          <template v-if="confirmRevoke">
            <span class="y-tiny confirm-note">Sign out every browser except this one?</span>
            <button
              class="y-btn-danger"
              :disabled="sessionsBusy"
              @click="revokeOthers"
            >
              {{ sessionsBusy ? 'Signing out…' : 'Yes, sign them out' }}
            </button>
            <button
              class="y-btn-link"
              :disabled="sessionsBusy"
              @click="confirmRevoke = false"
            >
              Cancel
            </button>
          </template>
          <button
            v-else
            class="y-btn-outline"
            :disabled="!otherSessions.length"
            @click="confirmRevoke = true"
          >
            Sign out everywhere else
          </button>
          <span
            v-if="sessionsMessage"
            class="y-tiny"
            role="status"
          >{{ sessionsMessage }}</span>
        </div>
      </section>
    </template>

    <PageFooter />
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  min-width: 0;
  padding: 40px 56px 60px;
  max-width: 820px;
}

.top { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
h1 { font-size: 26px; }
.who { color: var(--fg-subtle); font-size: 13.5px; }
.out { margin-left: auto; }

.loading { margin-top: 24px; }

.y-card { margin-top: 18px; }
.y-card:first-of-type { margin-top: 24px; }

.profile-body { margin-top: 16px; display: flex; gap: 20px; align-items: flex-start; }

.avatar-col {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--teal);
  object-fit: cover;
}
.initials {
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  font-size: 26px;
}

.src {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  border-radius: var(--r-pill);
  padding: 2px 9px;
  background: var(--teal-badge);
  color: var(--teal-dark);
}
.src.custom { background: var(--neutral-bg); color: var(--fg-muted); }

.profile-fields { flex: 1; min-width: 0; }

.hint { margin: 0; font-size: 12.5px; color: var(--fg-subtle); line-height: 1.5; }

.grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.wide { grid-column: 1 / -1; }

.fine { margin: 8px 0 0; }

.actions {
  margin-top: 14px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.save { margin-left: auto; padding: 9px 20px; }
.hidden-file { display: none; }

.msg { margin: 8px 0 0; font-size: 12.5px; }

.head-row { display: flex; align-items: center; gap: 10px; }
.head-row .y-pill { margin-left: auto; }

.y-body { margin: 8px 0 0; }

.row {
  margin-top: 14px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.confirm-note { color: var(--danger); font-weight: 700; }

/* ---- sessions ---- */
.session-list { list-style: none; margin: 14px 0 0; padding: 0; border-top: 1.5px solid var(--border-soft); }
.session-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-hair);
  flex-wrap: wrap;
}
.session-row .iconify { color: var(--teal); flex: none; }
.session-name { font-weight: 700; font-size: 13.5px; }
.session-meta { margin-left: auto; }

/* ---- palette swatches ---- */
.palettes {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
}
.swatch {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 7px;
  padding: 6px;
  border: 1.5px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--bg-card);
  cursor: pointer;
  font: inherit;
  color: var(--fg-muted);
  transition: border-color 0.12s, box-shadow 0.12s;
}
.swatch:hover:not(:disabled) { border-color: var(--border-strong); }
.swatch.on { border-color: var(--teal); box-shadow: 0 0 0 2px var(--teal-badge); color: var(--teal-dark); }
.swatch:disabled { cursor: default; }
.swatch-art {
  position: relative;
  height: 54px;
  border-radius: var(--r-xs);
  border: 1px solid var(--border-soft);
  overflow: hidden;
  display: block;
}
.swatch-bar { position: absolute; inset: 0 auto 0 0; width: 30%; }
.swatch-dot { position: absolute; top: 12px; left: 42%; width: 14px; height: 14px; border-radius: 50%; }
.swatch-line { position: absolute; left: 42%; right: 12%; top: 34px; height: 6px; border-radius: 3px; opacity: 0.45; }
.swatch-name { font-size: 12px; font-weight: 800; text-align: center; }

@media (max-width: 860px) {
  .page { padding: 32px 24px 48px; }
  .profile-body { flex-direction: column; }
  .grid { grid-template-columns: 1fr; }
}
</style>
