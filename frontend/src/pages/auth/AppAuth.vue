<template>
  <section class="auth flex">
    <UiDecorationBlock class="auth__content">
      <RouterView />
    </UiDecorationBlock>
  </section>
</template>

<script setup lang="ts">
import UiDecorationBlock from '@/components/Ui/UiDecorationBlock.vue'
</script>

<style scoped>
.auth {
  justify-content: center;
  align-items: center;
  width: 100%;
}

.auth__content {
  width: 35%;
}
</style>
