<template>
  <time class="landing-clock text-sm" aria-label="Местное время">
    {{ time }}
  </time>
</template>

<script setup lang="ts">
defineOptions({ name: "LandingClock" });

const time = ref("");
let intervalId: ReturnType<typeof setInterval> | undefined;

function updateTime(): void {
  const now = new Date();
  time.value = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

onMounted(() => {
  updateTime();
  intervalId = setInterval(updateTime, 60_000);
});

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId);
});
</script>

<style scoped>
.landing-clock {
  display: inline-flex;
  height: 1.75rem;
  align-items: center;
  justify-content: center;
  padding-inline: 0.5rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: var(--p-button-border-radius);
  color: var(--p-primary-color);
}
</style>
