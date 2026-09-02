<script setup lang="ts">
import { APP_NAME, APP_TAGLINE } from '#shared/app'

const { user, displayName } = useAuth()

const greeting = computed(() => {
  if (!user.value) return `Welcome to ${APP_NAME} 👋`
  return displayName.value ? `Welcome back, ${displayName.value} 👋` : 'Welcome back 👋'
})

// ---- First-visit walkthrough ------------------------------------------------
// Three steps to a finished profile. Hidden once everything's done, or after
// "Skip for now" (remembered server-side).
const skipBusy = ref(false)

const setupSteps = computed(() => {
  const u = user.value
  if (!u) return []
  return [
    {
      key: 'photo',
      done: Boolean(u.avatarUrl),
      title: 'Add a profile picture',
      blurb: 'Upload a photo — or skip this one: without an upload we show your Gravatar (the picture tied to your email), or your initials if there isn\'t one.',
      to: '/account#profile',
      cta: 'Upload a photo'
    },
    {
      key: 'name',
      done: Boolean(u.firstName),
      title: 'Tell us your name',
      blurb: 'So the greeting up top can say hi properly.',
      to: '/account#profile',
      cta: 'Add your name'
    },
    {
      key: 'palette',
      done: Boolean(u.palette),
      title: 'Pick a colour palette',
      blurb: 'Seven looks for the whole app. Teal is the house style; the rest are yours to try.',
      to: '/account#palette',
      cta: 'Choose a palette'
    }
  ]
})
const setupDone = computed(() => setupSteps.value.filter(s => s.done).length)
const showSetup = computed(() =>
  Boolean(user.value) && !user.value?.onboardingDismissedAt
  && setupSteps.value.length > 0 && setupDone.value < setupSteps.value.length)

async function skipSetup () {
  if (skipBusy.value || !user.value) return
  skipBusy.value = true
  try {
    await $fetch('/api/account/profile', { method: 'PATCH', body: { dismissOnboarding: true } })
    user.value = { ...user.value, onboardingDismissedAt: new Date().toISOString() }
  } catch { /* the card simply shows again next visit */ } finally {
    skipBusy.value = false
  }
}
</script>

<template>
  <main class="page">
    <h1>{{ greeting }}</h1>
    <p class="lede">
      {{ APP_TAGLINE }}. Accounts, profiles, and deployment are done — everything below the fold is yours to replace.
    </p>

    <section
      v-if="showSetup"
      class="setup y-card"
      aria-labelledby="setup-title"
    >
      <div class="setup-head">
        <div>
          <div
            id="setup-title"
            class="setup-title"
          >
            Fill in your profile
          </div>
          <div class="y-small">
            A few quick things and {{ APP_NAME }} feels like home. {{ setupDone }} of {{ setupSteps.length }} done.
          </div>
        </div>
        <div
          class="setup-meter"
          :style="{ '--pct': `${(setupDone / setupSteps.length) * 100}%` }"
          aria-hidden="true"
        >
          <span />
        </div>
      </div>
      <ol class="setup-steps">
        <li
          v-for="(step, i) in setupSteps"
          :key="step.key"
          class="setup-step"
          :class="{ done: step.done }"
        >
          <span class="setup-num">{{ step.done ? '✓' : i + 1 }}</span>
          <div class="setup-body">
            <div class="setup-step-title">
              {{ step.title }}
            </div>
            <p class="y-small">
              {{ step.blurb }}
            </p>
            <NuxtLink
              v-if="!step.done"
              :to="step.to"
              class="y-btn-outline setup-cta"
            >{{ step.cta }}</NuxtLink>
          </div>
        </li>
      </ol>
      <div class="setup-foot">
        <button
          class="y-btn-link"
          :disabled="skipBusy"
          @click="skipSetup"
        >
          {{ skipBusy ? 'Skipping…' : 'Skip for now' }}
        </button>
        <span class="y-tiny">You can do all of this on the <NuxtLink to="/account">account page</NuxtLink> any time.</span>
      </div>
    </section>

    <div class="tiles">
      <NuxtLink
        to="/scratch"
        class="y-tile"
      >
        <Icon
          name="lucide:notebook-pen"
          size="24"
        />
        <div class="y-tile-title">Scratchpad →</div>
        <p>
          The example feature: one note per person, saved in KV. Read it, then
          replace it with the thing you're actually building.
        </p>
      </NuxtLink>

      <NuxtLink
        to="/account"
        class="y-tile"
      >
        <Icon
          name="lucide:user-round-cog"
          size="24"
        />
        <div class="y-tile-title">Account →</div>
        <p>
          Name, photo, colour palette, and every browser you're signed in on —
          with a one-click sign-out for the rest.
        </p>
      </NuxtLink>
    </div>

    <PageFooter />
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  min-width: 0;
  padding: 48px 56px;
  max-width: var(--content-max);
}

h1 { font-size: 30px; }

.lede {
  margin: 8px 0 0;
  font-size: 15px;
  color: var(--fg-muted);
  max-width: 520px;
}

.tiles {
  margin-top: 28px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.y-tile { display: flex; flex-direction: column; }
.y-tile .iconify { color: var(--teal); }
.y-tile p { flex: 1; }

/* ---- first-visit walkthrough ---- */
.setup { margin-top: 20px; border-color: var(--teal-border); background: var(--teal-bg); }
.setup-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.setup-head > div:first-child { flex: 1; min-width: 220px; }
.setup-title { font-size: 17px; font-weight: 800; color: var(--teal-dark); }
.setup-meter {
  flex: none;
  width: 140px;
  height: 8px;
  border-radius: var(--r-pill);
  background: var(--teal-badge);
  overflow: hidden;
}
.setup-meter span { display: block; height: 100%; width: var(--pct, 0%); background: var(--teal); border-radius: inherit; transition: width 0.25s; }
.setup-steps { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 10px; }
.setup-step {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--teal-border);
  border-radius: var(--r-sm);
  background: var(--bg-card);
}
.setup-step.done { opacity: 0.62; }
.setup-num {
  flex: none;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--teal-badge);
  color: var(--teal-dark);
  font-size: 12.5px;
  font-weight: 800;
}
.setup-step.done .setup-num { background: var(--ok-bg); color: var(--ok); }
.setup-body { flex: 1; min-width: 0; }
.setup-step-title { font-weight: 800; font-size: 14px; }
.setup-step.done .setup-step-title { text-decoration: line-through; }
.setup-body p { margin: 3px 0 0; }
.setup-cta { margin-top: 10px; display: inline-flex; }
.setup-foot { margin-top: 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

@media (max-width: 860px) {
  .page { padding: 32px 24px; }
  .tiles { grid-template-columns: 1fr; }
}
</style>
