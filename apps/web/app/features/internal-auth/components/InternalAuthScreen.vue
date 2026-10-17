<template>
  <main class="mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
    <Card class="w-full">
      <template #title>Внутренний вход IndieBar</template>
      <template #content>
        <Message v-if="state.error" severity="error" :closable="false" class="mb-4">{{
          state.error
        }}</Message>

        <section v-if="state.user" class="space-y-4">
          <p>
            Вы вошли как <strong>{{ state.user.email }}</strong
            >.
          </p>
          <div class="flex flex-wrap gap-2">
            <Button
              v-if="state.user.permissions.includes('support_requests')"
              label="Очередь поддержки"
              icon="pi pi-inbox"
              severity="secondary"
              size="small"
              @click="navigateTo('/internal/support')"
            />
            <Button
              v-if="state.user.permissions.includes('service_access')"
              label="Временный доступ к продукции"
              severity="secondary"
              size="small"
              class="w-full"
              @click="navigateTo('/internal/service-access')"
            />
            <Button
              v-if="state.user.permissions.includes('global_catalog')"
              label="Проверка каталога"
              icon="pi pi-database"
              severity="secondary"
              size="small"
              @click="navigateTo('/internal/catalog')"
            />
            <Button
              v-if="state.user.permissions.includes('global_catalog')"
              label="Управление каталогом"
              icon="pi pi-pencil"
              severity="secondary"
              size="small"
              @click="navigateTo('/internal/catalog/manage')"
            />
            <Button
              v-if="state.user.permissions.includes('internal_audit')"
              label="Журнал действий"
              icon="pi pi-list"
              severity="secondary"
              size="small"
              @click="navigateTo('/internal/audit')"
            />
            <Button
              v-if="state.user.permissions.includes('product_analytics')"
              label="Продуктовая аналитика"
              icon="pi pi-chart-bar"
              severity="secondary"
              size="small"
              @click="navigateTo('/internal/analytics')"
            />
            <Button label="Выйти" size="small" :loading="state.busy" @click="logout()" />
            <Button
              label="Завершить все сессии"
              severity="secondary"
              size="small"
              :loading="state.busy"
              @click="logout(true)"
            />
          </div>
        </section>

        <form v-else-if="mode === 'login'" class="space-y-3" @submit.prevent="submitLogin">
          <FloatLabel variant="on"
            ><InputText
              id="internal-email"
              v-model="state.email"
              required
              type="email"
              autocomplete="username"
              maxlength="254"
              size="small"
              class="w-full"
            /><label for="internal-email">Электронная почта</label></FloatLabel
          >
          <FloatLabel variant="on"
            ><Password
              v-model="state.password"
              input-id="internal-password"
              required
              :feedback="false"
              autocomplete="current-password"
              :input-props="{ maxlength: 256 }"
              size="small"
              input-class="w-full"
              class="w-full"
            /><label for="internal-password">Пароль</label></FloatLabel
          >
          <Button
            type="submit"
            label="Продолжить"
            :loading="state.busy"
            size="small"
            class="w-full"
          />
          <div class="flex flex-col items-center gap-1">
            <Button
              type="button"
              label="Восстановить доступ по recovery-коду"
              variant="text"
              size="small"
              @click="mode = 'recovery'"
            />
            <Button
              type="button"
              label="Первичная настройка аккаунта"
              variant="text"
              size="small"
              @click="mode = 'setup-token'"
            />
          </div>
        </form>

        <form v-else-if="mode === 'totp'" class="space-y-3" @submit.prevent="submitTotp">
          <p class="text-sm text-surface-600">
            Введите одноразовый код из приложения-аутентификатора.
          </p>
          <FloatLabel variant="on"
            ><InputText
              id="internal-code"
              v-model="state.code"
              required
              inputmode="numeric"
              autocomplete="one-time-code"
              minlength="6"
              maxlength="6"
              size="small"
              class="w-full"
            /><label for="internal-code">Код TOTP</label></FloatLabel
          >
          <Button type="submit" label="Войти" :loading="state.busy" size="small" class="w-full" />
          <Button
            type="button"
            label="Назад"
            variant="text"
            size="small"
            class="w-full"
            @click="mode = 'login'"
          />
        </form>

        <form
          v-else-if="mode === 'setup-token'"
          class="space-y-3"
          @submit.prevent="submitSetupStart"
        >
          <p class="text-sm text-surface-600">
            Вставьте одноразовый токен, который вам передал оператор.
          </p>
          <FloatLabel variant="on"
            ><InputText
              id="setup-token"
              v-model="state.setupToken"
              required
              autocomplete="off"
              size="small"
              class="w-full"
            /><label for="setup-token">Токен настройки</label></FloatLabel
          >
          <Button
            type="submit"
            label="Начать настройку"
            :loading="state.busy"
            size="small"
            class="w-full"
          />
          <Button
            type="button"
            label="Назад"
            variant="text"
            size="small"
            class="w-full"
            @click="mode = 'login'"
          />
        </form>

        <form v-else-if="mode === 'setup'" class="space-y-3" @submit.prevent="submitSetupComplete">
          <p class="text-sm text-surface-600">
            Добавьте TOTP в приложение-аутентификатор по QR-коду. Секрет также можно ввести вручную.
          </p>
          <img
            v-if="state.qrCodeDataUrl"
            :src="state.qrCodeDataUrl"
            alt="QR-код настройки TOTP"
            class="mx-auto size-48"
          />
          <p class="break-all rounded-md bg-surface-100 p-3 text-center font-mono text-sm">
            {{ state.secret }}
          </p>
          <FloatLabel variant="on"
            ><Password
              v-model="state.password"
              input-id="setup-password"
              required
              :feedback="false"
              autocomplete="new-password"
              :input-props="{ minlength: 8, maxlength: 256 }"
              size="small"
              input-class="w-full"
              class="w-full"
            /><label for="setup-password">Новый пароль</label></FloatLabel
          >
          <FloatLabel variant="on"
            ><InputText
              id="setup-code"
              v-model="state.code"
              required
              inputmode="numeric"
              autocomplete="one-time-code"
              minlength="6"
              maxlength="6"
              size="small"
              class="w-full"
            /><label for="setup-code">Код из приложения</label></FloatLabel
          >
          <Button
            type="submit"
            label="Подтвердить настройку"
            :loading="state.busy"
            size="small"
            class="w-full"
          />
        </form>

        <form v-else-if="mode === 'recovery'" class="space-y-3" @submit.prevent="submitRecovery">
          <p class="text-sm text-surface-600">
            Подтвердите пароль и введите один сохранённый recovery-код. Будут завершены все
            внутренние сессии.
          </p>
          <FloatLabel variant="on"
            ><InputText
              id="recovery-email"
              v-model="state.email"
              required
              type="email"
              autocomplete="username"
              maxlength="254"
              size="small"
              class="w-full"
            /><label for="recovery-email">Электронная почта</label></FloatLabel
          >
          <FloatLabel variant="on"
            ><Password
              v-model="state.password"
              input-id="recovery-password"
              required
              :feedback="false"
              autocomplete="current-password"
              :input-props="{ maxlength: 256 }"
              size="small"
              input-class="w-full"
              class="w-full"
            /><label for="recovery-password">Пароль</label></FloatLabel
          >
          <FloatLabel variant="on"
            ><InputText
              id="recovery-code"
              v-model="state.recoveryCode"
              required
              autocomplete="off"
              maxlength="64"
              size="small"
              class="w-full"
            /><label for="recovery-code">Recovery-код</label></FloatLabel
          >
          <Button
            type="submit"
            label="Начать восстановление"
            :loading="state.busy"
            size="small"
            class="w-full"
          />
          <Button
            type="button"
            label="Назад"
            variant="text"
            size="small"
            class="w-full"
            @click="mode = 'login'"
          />
        </form>

        <form
          v-else-if="mode === 'recovery-setup'"
          class="space-y-3"
          @submit.prevent="submitRecoveryComplete"
        >
          <p class="text-sm text-surface-600">
            Добавьте новый TOTP в приложение по QR-коду, затем подтвердите его свежим кодом.
          </p>
          <img
            v-if="state.qrCodeDataUrl"
            :src="state.qrCodeDataUrl"
            alt="QR-код настройки TOTP"
            class="mx-auto size-48"
          />
          <p class="break-all rounded-md bg-surface-100 p-3 text-center font-mono text-sm">
            {{ state.secret }}
          </p>
          <FloatLabel variant="on"
            ><InputText
              id="recovery-new-code"
              v-model="state.code"
              required
              inputmode="numeric"
              autocomplete="one-time-code"
              minlength="6"
              maxlength="6"
              size="small"
              class="w-full"
            /><label for="recovery-new-code">Код из приложения</label></FloatLabel
          >
          <Button
            type="submit"
            label="Подтвердить новый TOTP"
            :loading="state.busy"
            size="small"
            class="w-full"
          />
        </form>

        <section v-else-if="mode === 'codes'" class="space-y-3">
          <Message severity="warn" :closable="false"
            >Сохраните коды сейчас. Повторно показать их будет нельзя.</Message
          >
          <ul class="grid grid-cols-2 gap-2 rounded-md bg-surface-100 p-3 font-mono text-sm">
            <li v-for="code in state.recoveryCodes" :key="code">{{ code }}</li>
          </ul>
          <Button label="Я сохранил коды" size="small" class="w-full" @click="finishEnrollment" />
        </section>
      </template>
    </Card>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useInternalAuth } from "../composables/useInternalAuth";

type ScreenMode =
  "login" | "totp" | "setup-token" | "setup" | "recovery" | "recovery-setup" | "codes";

const auth = useInternalAuth();
const { state } = auth;
const mode = ref<ScreenMode>("login");

onMounted(async () => {
  await auth.loadSession();
});

async function submitLogin() {
  await auth.login();
  if (state.challenge) mode.value = "totp";
}

async function submitTotp() {
  await auth.verifyLogin();
}

async function submitSetupStart() {
  await auth.startSetup();
  if (state.qrCodeDataUrl) mode.value = "setup";
}

async function submitSetupComplete() {
  await auth.completeSetup();
  if (state.recoveryCodes.length) mode.value = "codes";
}

async function submitRecovery() {
  await auth.recover();
  if (state.challenge) {
    state.setupToken = state.challenge;
    await auth.startSetup(true);
    if (state.qrCodeDataUrl) mode.value = "recovery-setup";
  }
}

async function submitRecoveryComplete() {
  await auth.completeSetup(true);
  if (state.recoveryCodes.length) mode.value = "codes";
}

function finishEnrollment() {
  state.recoveryCodes = [];
  state.secret = "";
  state.qrCodeDataUrl = "";
  state.challenge = "";
  mode.value = "login";
}

async function logout(all = false) {
  await auth.logout(all);
}
</script>
