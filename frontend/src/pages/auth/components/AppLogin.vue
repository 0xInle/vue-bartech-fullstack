<template>
  <div>
    <Transition name="fade">
      <AppError :text="loginError" class="auth-error" />
    </Transition>
    <h1 class="auth__title">bartech.</h1>
    <div class="auth__subtitle">Войдите в систему</div>
    <form class="auth__form-content flex" @submit.prevent="onSumbit">
      <div class="auth__form-section flex">
        <label class="auth__form-label"> Email: </label>
        <UiInput
          class="auth__form-input"
          v-model="email"
          type="email"
          placeholder="Введите email"
        />
        <span class="auth__form-error">{{ emailError }}</span>
      </div>
      <div class="auth__form-section flex">
        <label class="auth__form-label"> Пароль: </label>
        <UiInput
          class="auth__form-input"
          v-model="password"
          type="password"
          placeholder="Введите пароль"
        />
        <span class="auth__form-error">{{ passwordError }}</span>
      </div>
      <UiButton type="submit" :disabled="!meta.valid">Войти</UiButton>
      <div class="auth__form-footer flex">
        <p class="auth__form-footer-text">Нет аккаунта?</p>
        <RouterLink to="/register" class="auth__form-footer-link link-reset">
          Зарегистрироваться
        </RouterLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { api } from '@/api/api'
import UiButton from '@/components/Ui/UiButton.vue'
import UiInput from '@/components/Ui/UiInput.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLoginForm } from '../composables/useLoginValidate'
import type { AxiosError } from 'axios'
import AppError from './AppError.vue'

const router = useRouter()
const loginError = ref('')
const { email, emailError, password, passwordError, handleSubmit, meta } = useLoginForm()

const onSumbit = handleSubmit(async (values, { resetForm }) => {
  loginError.value = ''
  try {
    await api.post('/users/login', {
      email: values.email,
      password: values.password,
    })
    resetForm()
    router.push('/home')
  } catch (err) {
    const error = err as AxiosError<{ error: string }>
    loginError.value = error.response?.data?.error || 'Ошибка сервера'
  }
})
</script>

<style scoped>
.auth-error {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
}

.auth__content {
  width: 35%;
}

.auth__title {
  max-width: max-content;
  margin: 0 auto 20px;
  color: var(--black-color);
  outline: none;
  font-size: 30px;
  background-color: var(--green-bright-color);
}

.auth__subtitle {
  color: var(--white-color);
  text-align: center;
  font-size: 14px;
  margin-bottom: 20px;
}

.auth__form-content {
  flex-direction: column;
}

.auth__form-section {
  flex-direction: column;
  position: relative;
  margin-bottom: 20px;
}

.auth__form-label {
  color: var(--white-color);
  font-size: 12px;
  margin-bottom: 5px;
}

.auth__form-input {
  padding: 5px;
  border: 1px solid var(--black-color);
  color: var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.auth__form-error {
  color: var(--red-color);
  position: absolute;
  bottom: -15px;
  left: 0;
  font-size: 10px;
}

.auth__form-footer {
  flex-direction: column;
  align-items: center;
  color: var(--white-color);
  margin-top: 15px;
  font-size: 12px;
}

.auth__form-footer-link {
  color: var(--green-bright-color);
  position: relative;
  outline: none;
  font-size: 12px;
  transition: all 0.3s ease-in-out;

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

  &:focus::after {
    width: 100%;
  }
}

.auth__form-footer-text {
  margin: 0 0 10px;
}

:disabled {
  cursor: not-allowed;
  background-color: var(--gray-light-color);
  border-color: var(--gray-light-color);
}

:disabled:hover {
  background-color: var(--gray-light-color);
  border-color: var(--gray-light-color);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
