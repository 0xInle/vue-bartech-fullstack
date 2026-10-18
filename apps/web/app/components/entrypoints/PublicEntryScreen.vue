<template>
  <main class="public-page min-h-screen px-4 pt-2 py-6 sm:px-6">
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

      <TransitionGroup
        tag="div"
        name="public-entry"
        class="public-entry-layout flex-1"
        :class="{ 'public-entry-layout--active': isEntryPanelVisible }"
      >
        <section key="hero" class="public-entry-hero">
          <h1 class="brand-eyebrow text-sm font-semibold uppercase tracking-[0.22em]">IndieBar</h1>
          <p class="brand-description mt-3 max-w-xl text-base leading-7">
            Рабочее пространство для барной команды.
          </p>
          <p class="brand-description max-w-xl mt-3 text-xs leading-7">
            Рецепты, заготовки и продукты внутри понятного интерфейса. <br />
            Ничего лишнего.
          </p>
          <div
            v-if="!flow.identity.currentUser.value"
            class="public-entry-actions mt-5 flex flex-wrap items-center gap-3"
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
          v-if="isEntryPanelVisible"
          id="public-entry-panel"
          key="entry-panel"
          class="public-entry-panel auth-panel rounded-2xl border p-4 shadow-sm sm:p-5"
          aria-live="polite"
        >
          <AccountSessionPanel
            v-if="flow.identity.currentUser.value"
            :full-name="flow.identity.currentUser.value.fullName"
            :busy="flow.formsDisabled.value"
            @logout="flow.run(flow.logout)"
          >
            <OrganizationsPanel
              :workplaces="flow.organizations.workplaces.value"
              :companies="flow.organizations.companies.value"
            />
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
            :busy="flow.busy.value"
            :disabled="flow.formsDisabled.value"
            @submit="flow.run(flow.submitRegistration)"
          />
          <EmailConfirmationForm
            v-else-if="flow.mode.value === 'register'"
            v-model:code="flow.registration.form.code"
            :email="flow.registration.form.email"
            :busy="flow.busy.value"
            :disabled="flow.formsDisabled.value"
            @submit="flow.run(flow.verifyRegistration)"
            @resend="flow.run(flow.resendRegistrationCode)"
            @edit="flow.registration.editDetails"
          />
          <LoginForm
            v-else-if="flow.mode.value === 'login'"
            v-model:email="flow.identity.credentials.email"
            v-model:password="flow.identity.credentials.password"
            :busy="flow.busy.value"
            :disabled="flow.formsDisabled.value"
            @submit="flow.run(flow.login)"
            @recover="flow.changeMode('recover')"
          />
          <PasswordRecoveryForm
            v-else-if="flow.mode.value === 'recover'"
            v-model:email="flow.identity.credentials.email"
            v-model:code="flow.identity.credentials.recoveryCode"
            v-model:new-password="flow.identity.credentials.newPassword"
            :step="flow.recoveryStep.value"
            :busy="flow.busy.value"
            :disabled="flow.formsDisabled.value"
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
      </TransitionGroup>

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
const isEntryPanelVisible = computed(
  () =>
    Boolean(flow.identity.currentUser.value) ||
    flow.mode.value !== "landing" ||
    Boolean(flow.notice.value) ||
    Boolean(flow.errorMessage.value),
);
</script>

<style scoped>
.public-entry-layout {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  align-items: center;
  transition:
    grid-template-columns 280ms cubic-bezier(0.22, 1, 0.36, 1),
    column-gap 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.public-entry-layout--active {
  grid-template-columns: minmax(0, 1fr) 22.5rem;
  column-gap: 2rem;
}

.public-entry-hero {
  grid-column: 1 / -1;
  display: flex;
  width: fit-content;
  max-width: 100%;
  flex-direction: column;
  align-items: center;
  margin-inline: auto;
  text-align: center;
  transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.public-entry-layout--active .public-entry-hero {
  grid-column: 1;
  width: min(100%, 42rem);
  align-items: flex-start;
  margin-right: auto;
  margin-left: 0;
  text-align: left;
}

.public-entry-actions {
  justify-content: center;
}

.public-entry-layout--active .public-entry-actions {
  justify-content: flex-start;
}

.public-entry-panel {
  grid-column: 2;
  width: 100%;
}

.public-entry-move {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.public-entry-enter-active,
.public-entry-leave-active {
  transition:
    opacity 280ms ease,
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.public-entry-enter-from,
.public-entry-leave-to {
  opacity: 0;
  transform: translateX(1.5rem);
}

.public-entry-enter-active {
  transition-delay: 50ms;
}

.public-entry-leave-active {
  position: absolute;
  top: 50%;
  right: 0;
  width: 22.5rem;
  translate: 0 -50%;
}

.public-page {
  background: var(--p-surface-50);
  color: var(--p-text-color);
}

.auth-panel {
  background: var(--p-content-background);
  border-color: var(--p-content-border-color);
  color: var(--p-content-color);
}

@media (max-width: 63.999rem) {
  .public-entry-layout,
  .public-entry-layout--active {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 1.5rem;
  }

  .public-entry-layout--active {
    align-content: start;
    padding-block: 2rem;
  }

  .public-entry-hero,
  .public-entry-layout--active .public-entry-hero,
  .public-entry-panel {
    grid-column: 1;
    width: 100%;
    margin-inline: auto;
  }

  .public-entry-panel {
    max-width: 28rem;
  }

  .public-entry-enter-from,
  .public-entry-leave-to {
    transform: translateY(1rem);
  }

  .public-entry-leave-active {
    position: static;
    top: auto;
    right: auto;
    width: 100%;
    translate: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .public-entry-layout,
  .public-entry-move,
  .public-entry-enter-active,
  .public-entry-leave-active {
    transition-duration: 1ms;
    transition-delay: 0ms;
  }
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
