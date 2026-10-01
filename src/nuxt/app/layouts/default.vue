<template>
  <div class="app">
    <AppSidebar />
    <slot />
    <!-- Registered by modules/feedback: the real button, or an empty stub
         when NUXT_FEATURE_FEEDBACK=0 compiled the feature out. -->
    <FeedbackFab />
  </div>
</template>

<style scoped>
/* align-items: start lets the sidebar's position: sticky engage — a stretched
   flex child can't stick. The centre column is the only thing that scrolls. */
.app {
  display: flex;
  align-items: flex-start;
  min-height: 100vh;
}

/* Phones: the sidebar is a top bar (AppSidebar.vue), the page below it. */
@media (max-width: 700px) {
  .app { flex-direction: column; align-items: stretch; }
}
</style>
