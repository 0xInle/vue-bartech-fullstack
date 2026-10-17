<template>
  <div v-if="!isOnline" class="fixed inset-x-4 top-4 z-50 mx-auto max-w-2xl">
    <Message severity="warn" :closable="false">
      Просмотр и изменение рабочих данных требуют подключения к интернету.
    </Message>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "NetworkStatusBanner" });

const { isOnline } = useNetworkStatus();
</script>
