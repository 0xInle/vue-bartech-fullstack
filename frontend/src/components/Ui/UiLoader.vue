<template>
  <div class="loader-wrapper">
    <span class="loader-dot"></span>
    <span class="loader-dot"></span>
    <span class="loader-dot"></span>
  </div>
</template>

<style scoped>
.loader-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5em;
}

.loader-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--black-color);
  animation: blink 1.4s infinite ease-in-out both;
}

.loader-dot:nth-child(1) {
  animation-delay: 0s;
}
.loader-dot:nth-child(2) {
  animation-delay: 0.2s;
}
.loader-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>
