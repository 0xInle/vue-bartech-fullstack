<template>
  <footer class="footer flex">
    <div class="footer-descr">
      © 2026 BarTech. Все права защищены.<br />
      Проект является разработкой компании BarTech.<br />
      Использование материалов сайта без согласия автора запрещено.
    </div>
    <ul class="footer-list list-reset flex">
      <li class="footer-item">
        <a href="#" class="footer-link link-reset">
          <IconContact class="footer-icon" />
        </a>
      </li>
      <li class="footer-item">
        <a href="#" class="footer-link link-reset">
          <IconHelp class="footer-icon" />
        </a>
      </li>
      <li class="footer-item">
        <a href="#" class="footer-link link-reset">
          <IconSun class="footer-icon" />
        </a>
      </li>
    </ul>
  </footer>
</template>

<script setup lang="ts">
import IconContact from '@/assets/icons/svg/icon-contact.svg'
import IconHelp from '@/assets/icons/svg/icon-help.svg'
import IconSun from '@/assets/icons/svg/icon-sun.svg'
</script>

<style scoped>
.footer {
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 20px;
  border: 1px solid var(--black-color);
  box-shadow: var(--box-shadow);
  border-radius: 10px;
}

.footer-descr {
  font-size: 10px;
}

.footer-list {
  gap: 20px;
}

.footer-link {
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
}
</style>
