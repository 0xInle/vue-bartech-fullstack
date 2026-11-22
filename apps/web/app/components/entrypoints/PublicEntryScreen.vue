<template>
  <main class="public-page min-h-screen px-4 pt-2 pb-2 sm:px-6">
    <div class="mx-auto flex min-h-[calc(100vh-1rem)] max-w-6xl flex-col">
      <header class="flex items-center justify-between gap-1">
        <Button
          type="button"
          :icon="colorScheme === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"
          :aria-label="colorScheme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'"
          :aria-pressed="colorScheme === 'dark'"
          class="app-icon-button"
          severity="secondary"
          variant="outlined"
          size="small"
          @click="toggleColorScheme"
        />
        <AccountProfileButton
          v-if="
            flow.identity.currentUser.value &&
            flow.identity.currentUser.value.accountStatus !== 'PENDING_DELETION'
          "
          :full-name="flow.identity.currentUser.value.fullName"
          @open="profileVisible = true"
        />
      </header>

      <TransitionGroup
        tag="div"
        name="public-entry"
        class="public-entry-layout flex-1"
        :class="{
          'public-entry-layout--active': isEntryPanelVisible,
        }"
      >
        <section key="hero" class="public-entry-hero">
          <p
            v-if="flow.mode.value === 'company'"
            class="brand-eyebrow text-sm font-semibold uppercase tracking-[0.22em]"
          >
            IndieBar
          </p>
          <h1 v-else class="brand-eyebrow text-sm font-semibold uppercase tracking-[0.22em]">
            IndieBar
          </h1>
          <p class="brand-description mt-3 max-w-xl text-sm leading-6">
            Рабочее пространство для барной команды.
          </p>
          <p class="brand-description max-w-xl mt-3 text-xs leading-7">Ничего лишнего.</p>
          <div class="public-entry-actions mt-3 flex flex-wrap items-center gap-3">
            <Button
              v-if="!flow.identity.currentUser.value"
              type="button"
              label="Зарегистрировать компанию"
              size="small"
              :aria-expanded="flow.mode.value === 'register'"
              @click="flow.toggleMode('register')"
            />
            <Button
              v-else-if="flow.identity.currentUser.value.accountStatus !== 'PENDING_DELETION'"
              type="button"
              label="Зарегистрировать компанию"
              size="small"
              :aria-expanded="flow.mode.value === 'company'"
              @click="flow.toggleMode('company')"
            />
            <Button
              v-if="
                !flow.identity.currentUser.value &&
                flow.mode.value !== 'login' &&
                flow.mode.value !== 'recover'
              "
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
          <CompanyCreationScreen
            v-if="
              flow.identity.currentUser.value &&
              flow.identity.currentUser.value.accountStatus !== 'PENDING_DELETION' &&
              flow.mode.value === 'company'
            "
            v-model:company-name="flow.companyForm.companyName"
            v-model:venue-name="flow.companyForm.venueName"
            v-model:initial-role="flow.companyForm.initialRole"
            :busy="flow.busy.value"
            :disabled="flow.formsDisabled.value"
            @submit="flow.run(flow.createCompany)"
            @cancel="flow.toggleMode('company')"
          />
          <PasswordRecoveryForm
            v-else-if="
              flow.identity.currentUser.value?.accountStatus === 'PENDING_DELETION' &&
              flow.mode.value === 'recover'
            "
            v-model:email="flow.identity.credentials.email"
            v-model:code="flow.identity.credentials.recoveryCode"
            v-model:new-password="flow.identity.credentials.newPassword"
            :step="flow.recoveryStep.value"
            :busy="flow.busy.value"
            :disabled="flow.formsDisabled.value"
            @request="flow.run(flow.requestRecovery)"
            @complete="flow.run(flow.completeRecovery)"
            @back="flow.changeMode('landing')"
          />
          <AccountDeletionPendingPanel
            v-else-if="flow.identity.currentUser.value?.accountStatus === 'PENDING_DELETION'"
            :deletion-scheduled-at="flow.identity.currentUser.value.deletionScheduledAt ?? null"
            :busy="flow.formsDisabled.value"
            :busy-action="flow.busy.value ? 'cancel' : ''"
            :error-message="flow.errorMessage.value"
            @cancel="flow.run(() => flow.cancelAccountDeletion($event))"
            @logout="flow.run(flow.logout)"
            @recover="flow.recoverPendingAccountPassword"
          />
          <template v-else-if="flow.identity.currentUser.value">
            <OrganizationsPanel
              :workplaces="flow.organizations.workplaces.value"
              :companies="flow.organizations.companies.value"
            />
          </template>
          <RegistrationForm
            v-else-if="flow.mode.value === 'register' && flow.registration.step.value === 'details'"
            v-model:company-name="flow.registration.form.companyName"
            v-model:venue-name="flow.registration.form.venueName"
            v-model:full-name="flow.registration.form.fullName"
            v-model:initial-role="flow.registration.form.initialRole"
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
            :disabled="flow.busy.value"
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

      <footer class="public-entry-footer mt-auto grid items-end gap-3 pt-4">
        <span class="landing-section-counter text-sm" aria-label="Секция 01 из 05">01 | 05</span>
        <Transition name="cookie-notice">
          <section
            v-if="showCookieNotice"
            class="cookie-notice rounded-xl border p-3 text-center shadow-sm"
            aria-label="Уведомление об использовании файлов cookie"
          >
            <p class="text-xs leading-5">
              Мы используем файлы cookie для улучшения работы сайта и повышения эффективности.
              Продолжив пользоваться сайтом, вы даёте свое согласие на применение файлов cookie.
            </p>
            <Button
              type="button"
              label="Согласен"
              size="small"
              severity="success"
              variant="outlined"
              class="mt-2"
              @click="acceptCookieNotice"
            />
          </section>
        </Transition>
        <nav class="public-entry-footer-nav flex gap-1" aria-label="Контакты и справка">
          <Button
            type="button"
            aria-label="Telegram"
            class="app-icon-button"
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
            class="app-icon-button"
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
              class="app-icon-button"
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
            class="app-icon-button"
            severity="secondary"
            variant="outlined"
            size="small"
          />
        </nav>
      </footer>
    </div>
    <AccountProfileDrawer v-model:visible="profileVisible" allow-account-deletion />
  </main>
</template>

<script setup lang="ts">
import { IconBrandTelegram } from "@tabler/icons-vue";
import EmailConfirmationForm from "~/features/registration/components/EmailConfirmationForm.vue";
import RegistrationForm from "~/features/registration/components/RegistrationForm.vue";
import LoginForm from "~/features/identity/components/LoginForm.vue";
import PasswordRecoveryForm from "~/features/identity/components/PasswordRecoveryForm.vue";
import AccountDeletionPendingPanel from "~/features/identity/components/AccountDeletionPendingPanel.vue";
import AccountProfileDrawer from "~/features/identity/components/AccountProfileDrawer.vue";
import AccountProfileButton from "~/features/identity/components/AccountProfileButton.vue";
import OrganizationsPanel from "~/features/organizations/components/OrganizationsPanel.vue";
import CompanyCreationScreen from "~/features/organizations/components/CompanyCreationScreen.vue";
import { useColorScheme } from "~/composables/useColorScheme";
import { usePublicEntryFlow } from "~/composables/usePublicEntryFlow";

defineOptions({ name: "PublicEntryScreen" });

const { colorScheme, toggleColorScheme } = useColorScheme();

const flow = usePublicEntryFlow();
const profileVisible = ref(false);
const cookieConsentStorageKey = "bartech-cookie-consent";
const showCookieNotice = ref(false);
const isEntryPanelVisible = computed(
  () =>
    Boolean(flow.identity.currentUser.value) ||
    flow.mode.value !== "landing" ||
    Boolean(flow.notice.value) ||
    Boolean(flow.errorMessage.value),
);

onMounted(() => {
  showCookieNotice.value = localStorage.getItem(cookieConsentStorageKey) !== "accepted";
});

function acceptCookieNotice(): void {
  localStorage.setItem(cookieConsentStorageKey, "accepted");
  showCookieNotice.value = false;
}
</script>

<style scoped>
.public-entry-footer {
  position: relative;
  grid-template-columns: minmax(0, 3fr) minmax(0, 4fr) minmax(0, 3fr);
}

.landing-section-counter {
  justify-self: start;
}

.cookie-notice {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 40%;
  max-width: 28rem;
  translate: -50% 0;
  background: var(--p-content-background);
  border-color: var(--p-content-border-color);
  color: var(--p-content-color);
}

.cookie-notice-enter-active,
.cookie-notice-leave-active {
  transition:
    opacity 280ms ease,
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.cookie-notice-enter-from,
.cookie-notice-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

.public-entry-footer-nav {
  grid-column: 3;
  justify-self: end;
}

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
  .public-entry-footer {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .landing-section-counter {
    grid-column: 1;
    justify-self: start;
  }

  .cookie-notice {
    bottom: calc(100% + 0.75rem);
    left: 0;
    width: 100%;
    max-width: none;
    translate: none;
  }

  .public-entry-footer-nav {
    grid-column: 2;
    justify-self: end;
  }

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
  .public-entry-leave-active,
  .cookie-notice-enter-active,
  .cookie-notice-leave-active {
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

:deep(.p-message-content) {
  align-items: flex-start;
}

:global(.app-dark) .public-page {
  background: var(--p-surface-950);
}
</style>
