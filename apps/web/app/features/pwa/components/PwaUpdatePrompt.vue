<template>
  <div v-if="showUpdatePrompt" class="fixed inset-x-4 top-24 z-50 mx-auto max-w-2xl">
    <Message severity="info" :closable="true" @close="dismissUpdate">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>
          {{
            updateFailed
              ? "Не удалось применить обновление. Попробуйте ещё раз."
              : "Доступно обновление."
          }}
        </span>
        <Button
          label="Обновить"
          size="small"
          :loading="applying"
          :disabled="applying"
          @click="applyUpdate"
        />
      </div>
    </Message>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "PwaUpdatePrompt" });

const pwa = useNuxtApp().$pwa;
const route = useRoute();
const dismissed = ref(false);
const applying = ref(false);
const updateFailed = ref(false);
const showUpdatePrompt = computed(() => Boolean(pwa?.needRefresh && !dismissed.value));

watch(
  () => pwa?.needRefresh,
  (needRefresh) => {
    if (!needRefresh) {
      dismissed.value = false;
      updateFailed.value = false;
    }
  },
  { immediate: true },
);

watch(
  () => route.fullPath,
  () => {
    if (pwa?.needRefresh) dismissed.value = false;
  },
);

function dismissUpdate() {
  dismissed.value = true;
}

async function applyUpdate() {
  if (!pwa || applying.value || !pwa.needRefresh) return;

  applying.value = true;
  updateFailed.value = false;

  try {
    await pwa.updateServiceWorker();
  } catch {
    updateFailed.value = true;
  } finally {
    applying.value = false;
  }
}
</script>
