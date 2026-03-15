<template>
  <section class="auth flex">
    <UiDecorationBlock class="auth__content">
      <h1 class="auth__title">bartech.</h1>
      <div class="auth__subtitle">Создайте аккаунт для работы с системой</div>
      <form class="auth__form-content flex" @submit.prevent="onSubmit">
        <div class="auth__form-section flex">
          <label class="auth__form-label"> Email: </label>
          <UiInput
            :class="emailError ? 'auth__form-input--error' : 'auth__form-input'"
            v-model="email"
            type="email"
            placeholder="Введите email"
          />
          <span class="auth__form-error">{{ emailError }}</span>
        </div>
        <div class="auth__form-section flex">
          <label class="auth__form-label"> Пароль: </label>
          <UiInput
            :class="passwordError ? 'auth__form-input--error' : 'auth__form-input'"
            v-model="password"
            type="password"
            placeholder="Введите пароль"
          />
          <span class="auth__form-error">{{ passwordError }}</span>
        </div>
        <div class="auth__form-section flex">
          <label class="auth__form-label"> Подтвердите пароль: </label>
          <UiInput
            :class="confirmPasswordError ? 'auth__form-input--error' : 'auth__form-input'"
            v-model="confirmPassword"
            type="password"
            placeholder="Подтвердите пароль"
          />
          <span class="auth__form-error">{{ confirmPasswordError }}</span>
        </div>
        <UiButton :disabled="!meta.valid" type="submit">Зарегистрироваться</UiButton>
      </form>
    </UiDecorationBlock>
  </section>
</template>

<script setup lang="ts">
import UiButton from '@/components/Ui/UiButton.vue'
import UiDecorationBlock from '@/components/Ui/UiDecorationBlock.vue'
import UiInput from '@/components/Ui/UiInput.vue'
import { useRegisterForm } from './composables/useRegisterValidate'
import { registerUser } from '@/api/auth.api'
import { useRouter } from 'vue-router'

const router = useRouter()

const {
  email,
  password,
  confirmPassword,
  emailError,
  passwordError,
  confirmPasswordError,
  handleSubmit,
  meta,
} = useRegisterForm()

const onSubmit = handleSubmit(async (values, { resetForm }) => {
  try {
    const user = await registerUser({
      email: values.email,
      password: values.password,
    })
    console.log('Registered user:', user)
    console.log('redirecting...')
    resetForm()
    router.push('/')
  } catch (error) {
    console.error(error)
  }
})
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

.auth__form-input--error {
  padding: 5px;
  border-color: var(--red-color);
  box-shadow: var(--error-shadow);

  &:focus {
    border-color: var(--red-color);
    box-shadow: var(--error-shadow);
  }
}

.auth__form-error {
  color: var(--red-color);
  position: absolute;
  bottom: -15px;
  left: 0;
  font-size: 10px;
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
</style>
