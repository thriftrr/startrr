<script setup lang="ts">
import { APP_NAME, APP_SLUG, APP_TAGLINE } from '#shared/app'

// Collapsible rail with flyout tooltips when collapsed, and the avatar /
// initials footer. Add your pages to `items`.
const { user } = useAuth()
const route = useRoute()
const { public: { feedback: feedbackEnabled } } = useRuntimeConfig()

const collapsed = ref(false)
const hovered = ref<string | null>(null)
const { avatarUrl, initials } = useAvatar()

const items = [
  { label: 'Home', to: '/', icon: 'lucide:house' },
  { label: 'Scratchpad', to: '/scratch', icon: 'lucide:notebook-pen' }
]

const STORAGE_KEY = `${APP_SLUG}:sidebar`

function isActive (to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(to + '/')
}

function toggle () {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(STORAGE_KEY, collapsed.value ? 'collapsed' : 'expanded')
  } catch { /* private mode — the toggle still works for this session */ }
}

onMounted(() => {
  try {
    collapsed.value = localStorage.getItem(STORAGE_KEY) === 'collapsed'
  } catch { /* default to expanded */ }
})
</script>

<template>
  <aside
    class="shell"
    :class="{ collapsed }"
    aria-label="Main"
  >
    <div class="head">
      <NuxtLink
        v-if="!collapsed"
        to="/"
        class="mark"
      >
        <img
          src="/logo-mark-light.svg"
          alt=""
          width="26"
          height="26"
          class="mark-img"
        >
        <span class="mark-word">{{ APP_NAME }}<span class="mark-dot">.</span></span>
      </NuxtLink>
      <NuxtLink
        v-else
        to="/"
        class="mark-solo"
        :title="`${APP_NAME} home`"
      >
        <img
          src="/logo-mark-light.svg"
          :alt="APP_NAME"
          width="26"
          height="26"
        >
      </NuxtLink>
      <button
        class="toggle"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-expanded="!collapsed"
        @click="toggle"
      >
        {{ collapsed ? '»' : '«' }}
      </button>
    </div>

    <div
      v-if="!collapsed"
      class="tagline"
    >
      {{ APP_TAGLINE }}
    </div>

    <nav class="nav">
      <div
        v-for="item in items"
        :key="item.to"
        class="row"
      >
        <NuxtLink
          :to="item.to"
          class="item"
          :class="{ on: isActive(item.to) }"
          @mouseenter="hovered = item.label"
          @mouseleave="hovered = null"
          @focus="hovered = item.label"
          @blur="hovered = null"
        >
          <Icon
            :name="item.icon"
            size="17"
            aria-hidden="true"
          />
          <span v-if="!collapsed">{{ item.label }}</span>
        </NuxtLink>
        <div
          v-if="collapsed && hovered === item.label"
          class="flyout"
        >
          <span class="arrow" />{{ item.label }}
        </div>
      </div>
    </nav>

    <!-- Admin-only: the feedback inbox. The API refuses non-admins anyway. -->
    <nav
      v-if="user?.isAdmin && feedbackEnabled"
      class="nav admin"
      aria-label="Admin"
    >
      <div class="row">
        <NuxtLink
          to="/admin/feedback"
          class="item"
          :class="{ on: isActive('/admin/feedback') }"
          @mouseenter="hovered = 'Feedback inbox'"
          @mouseleave="hovered = null"
          @focus="hovered = 'Feedback inbox'"
          @blur="hovered = null"
        >
          <Icon
            name="lucide:inbox"
            size="17"
            aria-hidden="true"
          />
          <span v-if="!collapsed">Feedback inbox</span>
        </NuxtLink>
        <div
          v-if="collapsed && hovered === 'Feedback inbox'"
          class="flyout"
        >
          <span class="arrow" />Feedback inbox
        </div>
      </div>
    </nav>

    <div class="foot">
      <NuxtLink
        v-if="user"
        to="/account"
        class="user"
        :title="`Account · ${user.email}`"
      >
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          alt=""
          width="24"
          height="24"
          class="avatar"
        >
        <span
          v-else
          class="avatar initials"
        >{{ initials }}</span>
        <span
          v-if="!collapsed"
          class="email"
        >{{ user.email }}</span>
      </NuxtLink>
      <NuxtLink
        v-else
        to="/login"
        class="user"
        title="Sign in"
      >
        <span class="avatar initials">→</span>
        <span
          v-if="!collapsed"
          class="email"
        >Sign in</span>
      </NuxtLink>
    </div>
  </aside>
</template>

<style scoped>
.shell {
  /* Pinned full-height rail: the sidebar never scrolls with the page, and
     scrolls internally only if its own nav outgrows the viewport. */
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  width: var(--sidebar-w);
  padding: 20px 12px 16px;
  background: var(--teal-deep);
  color: var(--nav-fg);
  display: flex;
  flex-direction: column;
  flex: none;
  transition: width 0.18s;
}

.shell.collapsed {
  width: var(--sidebar-w-collapsed);
  padding: 20px 10px 16px;
}

.head { display: flex; align-items: center; gap: 6px; }
.shell.collapsed .head { flex-direction: column; gap: 10px; justify-content: center; }

.mark {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 800;
  font-size: 19px;
  letter-spacing: 0.5px;
  color: #fff;
  padding: 2px 4px 2px 10px;
  text-decoration: none;
  white-space: nowrap;
}
.mark-img { display: block; border-radius: 6px; flex: none; }
.mark-dot { color: var(--nav-accent); }
.mark-solo { display: grid; place-items: center; }
.mark-solo img { display: block; border-radius: 6px; }

.toggle {
  width: 28px;
  height: 28px;
  margin-left: auto;
  border: none;
  border-radius: var(--r-xs);
  background: rgba(255, 255, 255, 0.08);
  color: var(--nav-fg-dim);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  flex: none;
  display: grid;
  place-items: center;
  padding: 0;
  line-height: 1;
}
.shell.collapsed .toggle { margin-left: 0; }
.toggle:hover { background: rgba(255, 255, 255, 0.14); color: #fff; }

.tagline {
  padding: 0 10px;
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--nav-fg-faint);
}

.nav { display: flex; flex-direction: column; gap: 3px; margin-top: 20px; }
.nav.admin { margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.14); }

.row { position: relative; }

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--r-sm);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  color: var(--nav-fg-dim);
  white-space: nowrap;
}
.shell.collapsed .item {
  width: 38px;
  height: 38px;
  padding: 0;
  margin: 0 auto;
  justify-content: center;
}
.item:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
.item.on { background: rgba(255, 255, 255, 0.18); color: #fff; }
.item .iconify { flex: none; }

.flyout {
  position: absolute;
  left: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 30;
  background: var(--fg);
  color: #fff;
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  padding: 6px 11px;
  border-radius: var(--r-xs);
  box-shadow: var(--shadow-pop);
  pointer-events: none;
}
.arrow {
  position: absolute;
  left: -4px;
  top: 50%;
  margin-top: -4px;
  width: 8px;
  height: 8px;
  background: var(--fg);
  transform: rotate(45deg);
}

.foot {
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.22);
  padding-top: 12px;
}

.user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: var(--r-sm);
  color: var(--nav-fg);
  text-decoration: none;
  font-size: 12.5px;
}
.shell.collapsed .user { padding: 4px; justify-content: center; }
.user:hover { background: rgba(255, 255, 255, 0.12); color: var(--nav-fg); }

.avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--teal);
  flex: none;
}
.initials {
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  font-size: 11px;
}

.email { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
