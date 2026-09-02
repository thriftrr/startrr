<template>
  <div class="auth">
    <slot />
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
</style>
