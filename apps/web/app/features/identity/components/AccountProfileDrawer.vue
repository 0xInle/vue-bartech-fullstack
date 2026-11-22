<template>
  <Drawer
    :visible="visible"
    position="right"
    class="drawer-size-md"
    :dismissable="!busy"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    @update:visible="$emit('update:visible', $event)"
  >
    <template #header="{ class: titleClass }">
      <span :class="[titleClass, 'leading-none']">Профиль</span>
    </template>

    <div v-if="account" class="space-y-6">
      <section class="space-y-3">
        <h2 class="text-sm font-medium">Имя и фамилия</h2>
        <Message
          v-if="nameError"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          {{ nameError }}
        </Message>
        <FloatLabel variant="on">
          <InputText
            id="profile-full-name"
            v-model="fullName"
            class="w-full"
            :invalid="nameInvalid"
            :disabled="busy"
            maxlength="120"
          />
          <label for="profile-full-name" class="text-xs">Имя и фамилия</label>
        </FloatLabel>
        <Button
          label="Сохранить имя"
          size="small"
          :loading="busyAction === 'name'"
          :disabled="busy || !nameChanged || !isValidPersonName(fullName)"
          @click="saveName"
        />
      </section>

      <Divider />

      <section class="space-y-3">
        <h2 class="text-sm font-medium">Электронная почта</h2>
        <p class="text-xs text-color-secondary">Основной адрес: {{ account.email }}</p>
        <Message
          v-if="emailError"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          {{ emailError }}
        </Message>
        <Message
          v-if="emailNotice"
          severity="success"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          {{ emailNotice }}
        </Message>
        <form v-if="!emailCodeSent" class="space-y-3" @submit.prevent="startEmailChange">
          <FloatLabel variant="on">
            <InputText
              id="profile-new-email"
              v-model="newEmail"
              class="w-full"
              type="email"
              autocomplete="email"
              :invalid="emailInvalid"
              :disabled="busy"
              maxlength="254"
            />
            <label for="profile-new-email" class="text-xs">Новый email</label>
          </FloatLabel>
          <FloatLabel variant="on">
            <InputText
              id="profile-email-password"
              v-model="emailPassword"
              class="w-full"
              type="password"
              autocomplete="current-password"
              :disabled="busy"
              maxlength="256"
            />
            <label for="profile-email-password" class="text-xs">Текущий пароль</label>
          </FloatLabel>
          <Button
            label="Отправить код подтверждения"
            size="small"
            :loading="busyAction === 'email'"
            :disabled="busy || !newEmail.trim() || !emailPassword"
            type="submit"
          />
        </form>
        <form v-else class="space-y-3" @submit.prevent="verifyEmailChange">
          <p class="text-xs text-color-secondary">Введите код, отправленный на {{ newEmail }}.</p>
          <FloatLabel variant="on">
            <InputText
              id="profile-email-code"
              v-model="emailCode"
              class="w-full"
              inputmode="numeric"
              autocomplete="one-time-code"
              :invalid="emailCodeInvalid"
              :disabled="busy"
              maxlength="6"
            />
            <label for="profile-email-code" class="text-xs">Код подтверждения</label>
          </FloatLabel>
          <div class="flex flex-wrap gap-2">
            <Button
              label="Подтвердить новый email"
              size="small"
              :loading="busyAction === 'email'"
              :disabled="busy || emailCode.length !== 6"
              type="submit"
            />
            <Button
              label="Отмена"
              severity="secondary"
              variant="outlined"
              size="small"
              :disabled="busy"
              @click="resetEmailChange"
            />
          </div>
        </form>
      </section>

      <Divider />

      <section class="space-y-3">
        <h2 class="text-sm font-medium">Смена пароля</h2>
        <Message
          v-if="passwordError"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          {{ passwordError }}
        </Message>
        <Message
          v-if="passwordNotice"
          severity="success"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          {{ passwordNotice }}
        </Message>
        <form class="space-y-3" @submit.prevent="changePassword">
          <FloatLabel variant="on">
            <InputText
              id="profile-current-password"
              v-model="currentPassword"
              class="w-full"
              type="password"
              autocomplete="current-password"
              :disabled="busy"
              maxlength="256"
            />
            <label for="profile-current-password" class="text-xs">Текущий пароль</label>
          </FloatLabel>
          <FloatLabel variant="on">
            <InputText
              id="profile-new-password"
              v-model="newPassword"
              class="w-full"
              type="password"
              autocomplete="new-password"
              :disabled="busy"
              maxlength="256"
            />
            <label for="profile-new-password" class="text-xs">Новый пароль</label>
          </FloatLabel>
          <FloatLabel variant="on">
            <InputText
              id="profile-confirm-password"
              v-model="passwordConfirmation"
              class="w-full"
              type="password"
              autocomplete="new-password"
              :invalid="passwordConfirmationInvalid"
              :disabled="busy"
              maxlength="256"
            />
            <label for="profile-confirm-password" class="text-xs">Повторите новый пароль</label>
          </FloatLabel>
          <Button
            label="Изменить пароль"
            size="small"
            :loading="busyAction === 'password'"
            :disabled="busy || !currentPassword || !newPassword || !passwordConfirmation"
            type="submit"
          />
        </form>
      </section>

      <Divider />

      <section v-if="showInstallAction" class="space-y-3">
        <h2 class="text-sm font-medium">Приложение</h2>
        <p class="text-xs text-color-secondary">Установите IndieBar на это устройство.</p>
        <Message
          v-if="installError"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          {{ installError }}
        </Message>
        <div class="flex flex-wrap gap-2">
          <Button
            label="Установить приложение"
            size="small"
            :loading="installing"
            :disabled="installing"
            @click="installApp"
          />
          <Button
            label="Не сейчас"
            severity="secondary"
            variant="outlined"
            size="small"
            :disabled="installing"
            @click="dismissInstall"
          />
        </div>
      </section>

      <Divider v-if="showInstallAction" />

      <section class="space-y-3">
        <h2 class="text-sm font-medium">Выход из аккаунта</h2>
        <div class="grid gap-2 sm:grid-cols-2">
          <Button
            label="Выйти на этом устройстве"
            severity="secondary"
            variant="outlined"
            size="small"
            :disabled="busy"
            @click="logout(false)"
          />
          <Button
            label="Выйти на всех устройствах"
            severity="secondary"
            variant="outlined"
            size="small"
            :disabled="busy"
            @click="logout(true)"
          />
        </div>
        <Message
          v-if="logoutError"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          {{ logoutError }}
        </Message>
      </section>

      <Divider v-if="allowAccountDeletion" />

      <section v-if="allowAccountDeletion" class="space-y-3">
        <h2 class="text-sm font-medium">Удаление аккаунта</h2>
        <Message severity="warn" size="small" :closable="false" :pt="compactMessagePt">
          После подтверждения рабочий доступ прекратится сразу. Аккаунт будет удалён через семь
          дней, если вы не отмените действие. Для удаления необходимо выйти из всех компаний и
          заведений и передать обязательные права управления.
        </Message>
        <Message
          v-if="hasMemberships"
          severity="info"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          Сначала покиньте все компании и заведения на странице выбора рабочих пространств.
        </Message>
        <Message
          v-if="deletionError"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          {{ deletionError }}
        </Message>
        <FloatLabel variant="on">
          <InputText
            id="profile-delete-password"
            v-model="deletionPassword"
            class="w-full"
            type="password"
            autocomplete="current-password"
            :disabled="busy || hasMemberships"
            maxlength="256"
          />
          <label for="profile-delete-password" class="text-xs">Текущий пароль</label>
        </FloatLabel>
        <Button
          label="Удалить аккаунт"
          severity="danger"
          size="small"
          :loading="busyAction === 'deletion'"
          :disabled="busy || hasMemberships || !deletionPassword"
          @click="requestDeletion"
        />
      </section>
    </div>
  </Drawer>
</template>

<script setup lang="ts">
import { isValidPersonName, normalizePersonName } from "~/utils/person-name";
import { compactMessagePt } from "~/utils/primevue-message";
import { useIdentityFlow } from "../composables/useIdentityFlow";

defineOptions({ name: "AccountProfileDrawer" });

withDefaults(defineProps<{ visible: boolean; allowAccountDeletion?: boolean }>(), {
  allowAccountDeletion: false,
});
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const identity = useIdentityFlow();
const pwa = useNuxtApp().$pwa;
const busyAction = ref("");
const installing = ref(false);
const installedFromPrompt = ref(false);
const fullName = ref("");
const nameError = ref("");
const emailError = ref("");
const emailNotice = ref("");
const newEmail = ref("");
const emailPassword = ref("");
const emailCode = ref("");
const emailCodeSent = ref(false);
const passwordError = ref("");
const passwordNotice = ref("");
const currentPassword = ref("");
const newPassword = ref("");
const passwordConfirmation = ref("");
const deletionError = ref("");
const deletionPassword = ref("");

const logoutError = ref("");
const installError = ref("");

const account = computed(() => identity.currentUser.value);
const busy = computed(() => Boolean(busyAction.value));
const nameChanged = computed(() => normalizePersonName(fullName.value) !== account.value?.fullName);
const nameInvalid = computed(() => Boolean(fullName.value) && !isValidPersonName(fullName.value));
const emailInvalid = computed(() => Boolean(emailError.value));
const emailCodeInvalid = computed(() => Boolean(emailError.value) && emailCode.value.length > 0);
const passwordConfirmationInvalid = computed(
  () => passwordConfirmation.value.length > 0 && passwordConfirmation.value !== newPassword.value,
);
const hasMemberships = computed(() =>
  Boolean(account.value?.workplaces.length || account.value?.companies.length),
);
const showInstallAction = computed(() =>
  Boolean(pwa?.showInstallPrompt && !pwa.isPWAInstalled && !installedFromPrompt.value),
);

watch(
  () => [identity.currentUser.value?.id, identity.currentUser.value?.fullName],
  () => {
    fullName.value = identity.currentUser.value?.fullName ?? "";
  },
  { immediate: true },
);

async function saveName(): Promise<void> {
  if (!account.value || !isValidPersonName(fullName.value) || !nameChanged.value) return;
  busyAction.value = "name";
  nameError.value = "";
  try {
    await identity.updateFullName(fullName.value);
  } catch (error) {
    nameError.value = toMessage(error, "Не удалось сохранить имя и фамилию.");
  } finally {
    busyAction.value = "";
  }
}

async function startEmailChange(): Promise<void> {
  busyAction.value = "email";
  emailError.value = "";
  emailNotice.value = "";
  try {
    await identity.startEmailChange(newEmail.value, emailPassword.value);
    emailCodeSent.value = true;
    emailNotice.value = "Код подтверждения отправлен на новый адрес.";
  } catch (error) {
    emailError.value = toMessage(error, "Не удалось отправить код подтверждения.");
  } finally {
    busyAction.value = "";
  }
}

async function verifyEmailChange(): Promise<void> {
  busyAction.value = "email";
  emailError.value = "";
  emailNotice.value = "";
  try {
    await identity.verifyEmailChange(emailCode.value);
    resetEmailChange();
    emailNotice.value = "Основной email изменён.";
  } catch (error) {
    emailError.value = toMessage(error, "Не удалось подтвердить новый адрес.");
  } finally {
    busyAction.value = "";
  }
}

function resetEmailChange(): void {
  newEmail.value = "";
  emailPassword.value = "";
  emailCode.value = "";
  emailCodeSent.value = false;
  emailError.value = "";
  emailNotice.value = "";
}

async function changePassword(): Promise<void> {
  passwordError.value = "";
  passwordNotice.value = "";
  if (newPassword.value !== passwordConfirmation.value) {
    passwordError.value = "Новые пароли не совпадают.";
    return;
  }
  busyAction.value = "password";
  try {
    await identity.changePassword(currentPassword.value, newPassword.value);
    currentPassword.value = "";
    newPassword.value = "";
    passwordConfirmation.value = "";
    passwordNotice.value = "Пароль изменён. Остальные сеансы завершены.";
  } catch (error) {
    passwordError.value = toMessage(error, "Не удалось изменить пароль.");
  } finally {
    busyAction.value = "";
  }
}

async function logout(allDevices: boolean): Promise<void> {
  busyAction.value = "logout";
  logoutError.value = "";
  try {
    if (allDevices) await identity.logoutAll();
    else await identity.logout();
    emit("update:visible", false);
    await navigateTo("/");
  } catch (error) {
    logoutError.value = toMessage(error, "Не удалось завершить сеанс. Попробуйте ещё раз.");
  } finally {
    busyAction.value = "";
  }
}

async function requestDeletion(): Promise<void> {
  busyAction.value = "deletion";
  deletionError.value = "";
  try {
    await identity.requestAccountDeletion(deletionPassword.value);
    emit("update:visible", false);
    await navigateTo("/");
  } catch (error) {
    deletionError.value = toMessage(error, "Не удалось запустить удаление аккаунта.");
  } finally {
    busyAction.value = "";
  }
}

async function installApp(): Promise<void> {
  if (!pwa || installing.value) return;
  installing.value = true;
  installError.value = "";
  try {
    const choice = await pwa.install();
    installedFromPrompt.value = choice?.outcome === "accepted";
  } catch {
    installError.value = "Не удалось открыть предложение установки. Попробуйте позже.";
  } finally {
    installing.value = false;
  }
}

function dismissInstall(): void {
  pwa?.cancelInstall();
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
</script>
