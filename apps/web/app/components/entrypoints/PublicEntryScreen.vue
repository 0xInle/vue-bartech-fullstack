<template>
  <main class="public-page min-h-screen px-4 py-6 sm:px-6">
    <div class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
      <header class="flex items-center justify-between">
        <LandingClock />
        <Button
          type="button"
          icon="pi pi-moon"
          aria-label="Тема"
          class="landing-icon-button"
          severity="secondary"
          variant="outlined"
          size="small"
        />
      </header>

      <div class="grid flex-1 items-center gap-8 lg:grid-cols-[1fr_360px]">
        <section class="max-w-2xl">
          <p class="brand-eyebrow text-sm font-semibold uppercase tracking-[0.22em]">IndieBar</p>
          <p class="brand-description mt-3 max-w-xl text-base leading-7">
            Рабочее пространство для барной команды.
          </p>
          <p class="brand-description max-w-xl mt-3 text-xs leading-7">
            Рецепты, заготовки и продукты внутри понятного интерфейса. <br />
            Ничего лишнего.
          </p>
          <div
            v-if="!flow.identity.currentUser.value"
            class="mt-5 flex flex-wrap items-center gap-3"
          >
            <Button
              type="button"
              label="Зарегистрировать компанию"
              size="small"
              :aria-expanded="flow.mode.value === 'register'"
              @click="flow.toggleMode('register')"
            />
            <Button
              type="button"
              label="Войти"
              size="small"
              severity="primary"
              variant="outlined"
              :aria-expanded="flow.mode.value === 'login'"
              @click="flow.toggleMode('login')"
            />
          </div>
        </section>

        <section
          v-if="
            flow.identity.currentUser.value ||
            flow.mode.value !== 'landing' ||
            flow.notice.value ||
            flow.errorMessage.value
          "
          id="public-entry-panel"
          class="auth-panel rounded-2xl border p-4 shadow-sm sm:p-5"
          aria-live="polite"
        >
          <AccountSessionPanel
            v-if="flow.identity.currentUser.value"
            :full-name="flow.identity.currentUser.value.fullName"
            :busy="flow.formsDisabled.value"
            @logout="flow.run(flow.logout)"
          >
            <OrganizationsPanel :workplaces="flow.organizations.workplaces.value" />
          </AccountSessionPanel>
          <RegistrationForm
            v-else-if="flow.mode.value === 'register' && flow.registration.step.value === 'details'"
            v-model:company-name="flow.registration.form.companyName"
            v-model:venue-name="flow.registration.form.venueName"
            v-model:full-name="flow.registration.form.fullName"
            v-model:email="flow.registration.form.email"
            v-model:password="flow.registration.form.password"
            v-model:password-confirmation="flow.registration.form.passwordConfirmation"
            :password-confirmation-error="flow.registration.passwordConfirmationError.value"
            :busy="flow.formsDisabled.value"
            @submit="flow.run(flow.submitRegistration)"
          />
          <EmailConfirmationForm
            v-else-if="flow.mode.value === 'register'"
            v-model:code="flow.registration.form.code"
            :email="flow.registration.form.email"
            :busy="flow.formsDisabled.value"
            @submit="flow.run(flow.verifyRegistration)"
            @resend="flow.run(flow.resendRegistrationCode)"
            @edit="flow.registration.editDetails"
          />
          <LoginForm
            v-else-if="flow.mode.value === 'login'"
            v-model:email="flow.identity.credentials.email"
            v-model:password="flow.identity.credentials.password"
            :busy="flow.formsDisabled.value"
            @submit="flow.run(flow.login)"
            @recover="flow.changeMode('recover')"
          />
          <PasswordRecoveryForm
            v-else-if="flow.mode.value === 'recover'"
            v-model:email="flow.identity.credentials.email"
            v-model:code="flow.identity.credentials.recoveryCode"
            v-model:new-password="flow.identity.credentials.newPassword"
            :step="flow.recoveryStep.value"
            :busy="flow.formsDisabled.value"
            @request="flow.run(flow.requestRecovery)"
            @complete="flow.run(flow.completeRecovery)"
            @back="flow.changeMode('login')"
          />

          <Message
            v-if="flow.notice.value"
            severity="success"
            :closable="false"
            class="mt-5 w-full"
          >
            {{ flow.notice.value }}
          </Message>
          <Message
            v-if="flow.errorMessage.value"
            severity="error"
            :closable="false"
            class="mt-5 w-full"
          >
            {{ flow.errorMessage.value }}
          </Message>
        </section>
      </div>

      <footer class="mt-auto flex items-center justify-between gap-2 pt-4">
        <span class="landing-section-counter text-sm" aria-label="Секция 01 из 05">01 | 05</span>
        <nav class="flex gap-1" aria-label="Контакты и справка">
          <Button
            type="button"
            aria-label="Telegram"
            class="landing-icon-button"
            severity="secondary"
            variant="outlined"
            size="small"
          >
            <template #icon>
              <IconBrandTelegram :size="14" :stroke-width="2" color="var(--p-primary-color)" />
            </template>
          </Button>
          <Button
            type="button"
            icon="pi pi-envelope"
            aria-label="Почта"
            class="landing-icon-button"
            severity="secondary"
            variant="outlined"
            size="small"
          />
          <NuxtLink v-slot="{ href, navigate }" to="/docs" custom>
            <Button
              as="a"
              :href="href"
              icon="pi pi-question-circle"
              aria-label="Документация"
              class="landing-icon-button"
              severity="secondary"
              variant="outlined"
              size="small"
              @click="navigate"
            />
          </NuxtLink>
          <Button
            type="button"
            icon="pi pi-headphones"
            aria-label="Поддержка"
            class="landing-icon-button"
            severity="secondary"
            variant="outlined"
            size="small"
          />
        </nav>
      </footer>
    </div>
  </main>
</template>

<script setup lang="ts">
import { IconBrandTelegram } from "@tabler/icons-vue";
import EmailConfirmationForm from "~/features/registration/components/EmailConfirmationForm.vue";
import RegistrationForm from "~/features/registration/components/RegistrationForm.vue";
import LoginForm from "~/features/identity/components/LoginForm.vue";
import PasswordRecoveryForm from "~/features/identity/components/PasswordRecoveryForm.vue";
import AccountSessionPanel from "~/features/identity/components/AccountSessionPanel.vue";
import OrganizationsPanel from "~/features/organizations/components/OrganizationsPanel.vue";
import LandingClock from "~/components/entrypoints/LandingClock.vue";
import { usePublicEntryFlow } from "~/composables/usePublicEntryFlow";

defineOptions({ name: "PublicEntryScreen" });

const flow = usePublicEntryFlow();
</script>

<style scoped>
.public-page {
  background: var(--p-surface-50);
  color: var(--p-text-color);
}

.auth-panel {
  background: var(--p-content-background);
  border-color: var(--p-content-border-color);
  color: var(--p-content-color);
}

:deep(.brand-eyebrow),
:deep(.inline-link) {
  color: var(--p-primary-color);
}

.landing-section-counter {
  display: inline-flex;
  height: 1.75rem;
  align-items: center;
  justify-content: center;
  padding-inline: 0.5rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: var(--p-button-border-radius);
  color: var(--p-primary-color);
}

:deep(.brand-description) {
  color: var(--p-text-muted-color);
}

:deep(.workspace-link) {
  border-color: var(--p-content-border-color);
  color: var(--p-content-color);
}

:deep(.workspace-link:hover) {
  border-color: var(--p-primary-color);
}

:deep(.p-password-input) {
  width: 100%;
}

:deep(.p-button.inline-link) {
  display: inline;
  padding: 0;
  vertical-align: baseline;
}

:deep(.p-button.inline-link:hover) {
  background: transparent;
}

:deep(.p-button.landing-icon-button .p-button-icon) {
  color: var(--p-primary-color);
  width: 0.875rem;
  height: 0.875rem;
  font-size: 0.875rem;
  line-height: 0.875rem;
}

:deep(.p-button.landing-icon-button) {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
}

:deep(.p-message-content) {
  align-items: flex-start;
}

:global(.app-dark) .public-page {
  background: var(--p-surface-950);
}
</style>
