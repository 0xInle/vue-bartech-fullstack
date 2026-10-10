<template>
  <main class="mx-auto min-h-screen max-w-xl px-4 py-10 sm:py-16">
    <section class="space-y-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">IndieBar</p>
      <div v-if="stage === 'loading'">
        <Message severity="info" :closable="false">Проверяем приглашение…</Message>
      </div>
      <div v-else-if="invitation" class="space-y-4">
        <div>
          <h1 class="text-xl font-semibold">Вас пригласили в команду</h1>
          <p v-if="invitation.venueName" class="mt-2 text-sm text-zinc-600">
            {{ invitation.companyName }} · {{ invitation.venueName }}
          </p>
          <p v-else class="mt-2 text-sm text-zinc-600">{{ invitation.companyName }}</p>
          <p class="text-sm text-zinc-600">Должность: {{ invitation.roleLabel }}</p>
          <p v-if="invitation.accessDescription" class="text-sm text-zinc-600">
            {{ invitation.accessDescription }}
          </p>
          <p class="text-sm text-zinc-500">Приглашение для {{ invitation.email }}</p>
        </div>
        <Message v-if="hasEmailMismatch" severity="warn" :closable="false">
          Вы вошли под другим адресом. Выйдите из аккаунта, чтобы принять или отклонить приглашение.
        </Message>
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <div v-if="stage === 'preview'" class="flex flex-wrap gap-2">
          <Button
            v-if="!hasEmailMismatch"
            label="Принять"
            size="small"
            :loading="busy"
            @click="accept"
          />
          <Button
            v-if="!hasEmailMismatch"
            label="Отклонить"
            severity="secondary"
            variant="outlined"
            size="small"
            :disabled="busy"
            @click="decline"
          />
          <Button
            v-if="
              identity.sessionState.value === 'authenticated' &&
              identity.currentUser.value?.email.toLowerCase() !== invitation.email.toLowerCase()
            "
            label="Выйти из аккаунта"
            variant="text"
            size="small"
            :loading="busy"
            @click="switchAccount"
          />
        </div>
        <section v-else-if="stage === 'choose'" class="space-y-3">
          <p class="text-sm text-zinc-600">Продолжите с приглашённым адресом электронной почты.</p>
          <Button label="У меня уже есть аккаунт" size="small" @click="stage = 'login'" />
          <Button
            label="Создать аккаунт"
            severity="secondary"
            variant="text"
            size="small"
            @click="stage = 'register'"
          />
          <Button
            v-if="identity.sessionState.value === 'authenticated'"
            label="Продолжить как текущий пользователь"
            severity="secondary"
            variant="text"
            size="small"
            @click="completeCurrentAccount"
          />
        </section>
        <form
          v-else-if="stage === 'register'"
          class="space-y-3"
          @submit.prevent="startRegistration"
        >
          <h2 class="text-base font-semibold">Создать аккаунт</h2>
          <FloatLabel variant="on">
            <InputText
              id="invite-full-name"
              v-model="form.fullName"
              required
              maxlength="120"
              size="small"
              class="w-full"
            />
            <label for="invite-full-name" class="text-xs">ФИО</label>
          </FloatLabel>
          <FloatLabel variant="on">
            <InputText
              id="invite-email"
              :model-value="form.email"
              disabled
              size="small"
              class="w-full"
            />
            <label for="invite-email" class="text-xs">Электронная почта приглашения</label>
          </FloatLabel>
          <FloatLabel variant="on">
            <Password
              id="invite-password"
              v-model="form.password"
              :feedback="false"
              toggle-mask
              required
              size="small"
              input-class="w-full"
              class="w-full"
            />
            <label for="invite-password" class="text-xs">Пароль</label>
          </FloatLabel>
          <Button type="submit" label="Продолжить" size="small" :loading="busy" />
        </form>
        <form v-else-if="stage === 'verify'" class="space-y-3" @submit.prevent="verifyRegistration">
          <h2 class="text-base font-semibold">Подтвердите электронную почту</h2>
          <p class="text-sm text-zinc-600">
            Введите код из письма, отправленного на {{ form.email }}.
          </p>
          <FloatLabel variant="on">
            <InputText
              id="invite-code"
              v-model="form.code"
              inputmode="numeric"
              pattern="[0-9]{6}"
              minlength="6"
              maxlength="6"
              autocomplete="one-time-code"
              required
              size="small"
              class="w-full"
            />
            <label for="invite-code" class="text-xs">Код подтверждения</label>
          </FloatLabel>
          <Button type="submit" label="Подтвердить и присоединиться" size="small" :loading="busy" />
          <Button
            type="button"
            label="Отправить новый код"
            severity="secondary"
            variant="text"
            size="small"
            :disabled="busy"
            @click="resendCode"
          />
        </form>
        <form v-else-if="stage === 'login'" class="space-y-3" @submit.prevent="loginAndJoin">
          <h2 class="text-base font-semibold">Войти в аккаунт</h2>
          <FloatLabel variant="on">
            <InputText
              id="invite-login-email"
              :model-value="form.email"
              disabled
              size="small"
              class="w-full"
            />
            <label for="invite-login-email" class="text-xs">Электронная почта приглашения</label>
          </FloatLabel>
          <FloatLabel variant="on">
            <Password
              id="invite-login-password"
              v-model="form.password"
              :feedback="false"
              required
              size="small"
              input-class="w-full"
              class="w-full"
            />
            <label for="invite-login-password" class="text-xs">Пароль</label>
          </FloatLabel>
          <Button type="submit" label="Войти и присоединиться" size="small" :loading="busy" />
        </form>
        <Button
          v-if="['choose', 'register', 'verify', 'login'].includes(stage)"
          label="Отменить присоединение"
          severity="secondary"
          variant="text"
          size="small"
          :disabled="busy"
          @click="cancelAcceptance"
        />
        <Message v-else-if="stage === 'done'" severity="info" :closable="false">
          Присоединение отменено. Для повторной попытки попросите отправителя создать новое
          приглашение.
        </Message>
        <Message v-else-if="stage === 'declined'" severity="info" :closable="false">
          Приглашение отклонено.
        </Message>
      </div>
      <Message
        v-else-if="error"
        :severity="stage === 'missing' ? 'info' : 'error'"
        :closable="false"
      >
        {{ error }}
      </Message>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useInvitationAcceptance } from "../composables/useInvitationAcceptance";

const {
  invitation,
  stage,
  error,
  busy,
  form,
  identity,
  accept,
  decline,
  startRegistration,
  verifyRegistration,
  resendCode,
  cancelAcceptance,
  loginAndJoin,
  completeCurrentAccount,
  switchAccount,
} = useInvitationAcceptance();

const hasEmailMismatch = computed(
  () =>
    identity.sessionState.value === "authenticated" &&
    identity.currentUser.value?.email.toLowerCase() !== invitation.value?.email.toLowerCase(),
);
</script>
