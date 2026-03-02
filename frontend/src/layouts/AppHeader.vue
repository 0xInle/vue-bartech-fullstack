<template>
  <header class="header flex">
    <RouterLink to="/" class="header-logo link-reset">bartech.</RouterLink>
    <ul class="header-list list-reset flex">
      <li class="header-item">
        <RouterLink to="restaurants" class="header-link link-reset">Рестораны</RouterLink>
      </li>
      <li class="header-item">
        <RouterLink to="tech" class="header-link link-reset">Технологические карты</RouterLink>
      </li>
      <li class="header-item">
        <RouterLink to="documents" class="header-link link-reset">Документы</RouterLink>
      </li>
      <li class="header-item">
        <RouterLink to="reports" class="header-link link-reset">Отчеты</RouterLink>
      </li>
      <li class="header-item">
        <RouterLink to="analytics" class="header-link link-reset">Аналитика</RouterLink>
      </li>
      <li class="header-item">
        <RouterLink to="suppliers" class="header-link link-reset">Поставщики</RouterLink>
      </li>
      <li class="header-item">
        <RouterLink to="about" class="header-link link-reset">О проекте</RouterLink>
      </li>
    </ul>
    <div class="headeer-profile flex">
      <UiButton class="header-btn" @click="openSettings">СБ</UiButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import UiButton from '@/components/Ui/UiButton.vue'

function openSettings() {
  console.log('Будет открыта вкладка')
}
</script>

<style scoped>
.header {
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-logo {
  color: var(--black-color);
  outline: none;
  font-size: 30px;
  background-color: var(--green-bright-color);
  transition: all 0.3s ease-in-out;

  &:hover {
    color: var(--white-color);
  }

  &:focus {
    color: var(--white-color);
  }
}

.header-list {
  align-items: center;
  padding: 7px 20px;
  border: 1px solid var(--black-color);
  gap: 20px;
  background-color: var(--black-color);
  box-shadow: var(--box-shadow);
  border-radius: 10px;
}

.header-link {
  color: var(--white-color);
  position: relative;
  outline: none;
  font-size: 14px;
  transition: all 0.3s ease-in-out;

  &:hover {
    color: var(--green-bright-color);
  }

  &:focus {
    color: var(--green-bright-color);
  }

  &:active {
    color: var(--green-bright-color);
  }

  &::after {
    width: 0;
    height: 1px;
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--green-bright-color);
    transition: all 0.3s ease-in-out;
  }

  &:hover::after {
    width: 100%;
  }
}

.headeer-profile {
  justify-content: end;
  width: 113.8px;
}

.header-btn {
  width: 34px;
  height: 34px;
  outline: none;
  border-radius: 50%;

  &:hover {
    color: var(--white-color);
  }
}

.header-logo.router-link-active {
  border-bottom: none;
}

:not(.header-logo).router-link-active {
  color: var(--green-bright-color);
  transition: all 0.3s ease-in-out;

  &::after {
    width: 100%;
    height: 1px;
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--green-bright-color);
    transition: all 0.3s ease-in-out;
  }
}
</style>
