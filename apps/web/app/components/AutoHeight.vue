<template>
  <div ref="container" class="auto-height" @transitionend="handleTransitionEnd">
    <div ref="content"><slot /></div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{ active: boolean }>();
const container = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
let observer: ResizeObserver | null = null;
let animationFrame = 0;
let isAnimating = false;
let pendingResize = false;

function animateToContentHeight(): void {
  const containerElement = container.value;
  const contentElement = content.value;
  if (!props.active || !containerElement || !contentElement) return;

  if (isAnimating) {
    pendingResize = true;
    return;
  }

  const currentHeight = containerElement.getBoundingClientRect().height;
  const nextHeight = contentElement.getBoundingClientRect().height;
  if (Math.abs(nextHeight - currentHeight) < 1) {
    containerElement.style.height = `${nextHeight}px`;
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    containerElement.style.height = `${nextHeight}px`;
    return;
  }

  isAnimating = true;
  containerElement.style.height = `${currentHeight}px`;
  void containerElement.offsetHeight;
  animationFrame = requestAnimationFrame(() => {
    containerElement.style.height = `${nextHeight}px`;
  });
}

function handleTransitionEnd(event: TransitionEvent): void {
  const containerElement = container.value;
  if (!containerElement || event.target !== containerElement || event.propertyName !== "height") {
    return;
  }

  isAnimating = false;
  if (pendingResize) {
    pendingResize = false;
    animateToContentHeight();
    return;
  }
}

watch(
  () => props.active,
  async (active) => {
    if (!active) {
      observer?.disconnect();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (container.value) container.value.style.height = "auto";
      isAnimating = false;
      pendingResize = false;
      return;
    }

    await nextTick();
    if (!props.active || !content.value) return;

    observer ??= new ResizeObserver(() => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(animateToContentHeight);
    });
    observer.disconnect();
    observer.observe(content.value);
    if (container.value) {
      container.value.style.height = `${content.value.getBoundingClientRect().height}px`;
    }
  },
  { immediate: true, flush: "post" },
);

onBeforeUnmount(() => {
  observer?.disconnect();
  if (animationFrame) cancelAnimationFrame(animationFrame);
});
</script>

<style scoped>
.auto-height {
  overflow: hidden;
  transition: height 220ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .auto-height {
    transition: none;
  }
}
</style>
