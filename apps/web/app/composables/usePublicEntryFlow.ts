import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { useOrganizations } from "~/features/organizations/composables/useOrganizations";
import { useRegistrationFlow } from "~/features/registration/composables/useRegistrationFlow";

export function usePublicEntryFlow() {
  const route = useRoute();
  const identity = useIdentityFlow();
  const registration = useRegistrationFlow(identity.mutationOptions, identity.apiFetch);
  const organizations = useOrganizations(
    identity.currentUser,
    identity.mutationOptions,
    identity.apiFetch,
  );
  const mode = ref<"landing" | "register" | "login" | "recover" | "company">("landing");
  const companyForm = reactive({
    companyName: "",
    venueName: "",
    initialRole: "" as "CHEF_BARTENDER" | "BAR_MANAGER" | "SENIOR_BARTENDER" | "BARTENDER" | "",
  });
  const recoveryStep = ref<"email" | "code">("email");
  const busy = ref(false);
  const errorMessage = ref("");
  const notice = ref("");

  async function run(action: () => Promise<void>): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    errorMessage.value = "";
    notice.value = "";
    try {
      if (!identity.csrfToken.value) await identity.refreshCsrf();
      await action();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "Не удалось выполнить запрос. Попробуйте ещё раз.";
    } finally {
      busy.value = false;
    }
  }

  async function initialize(): Promise<void> {
    const sessionLoad = identity.loadSession();
    try {
      await identity.refreshCsrf();
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : "Не удалось подготовить безопасное соединение. Обновите страницу и попробуйте ещё раз.";
    }
    await sessionLoad;
    if (identity.sessionState.value === "error") {
      errorMessage.value = identity.sessionErrorMessage.value;
    }
  }

  async function submitRegistration(): Promise<void> {
    if (!(await registration.begin())) return;
    notice.value =
      "Если этот адрес можно зарегистрировать, мы отправили на него код подтверждения. Введите код из письма.";
  }

  async function createCompany(): Promise<void> {
    if (!companyForm.initialRole) throw new Error("Выберите должность для новой компании.");
    await navigateTo(
      await organizations.createCompany({
        ...companyForm,
        initialRole: companyForm.initialRole,
      }),
    );
  }

  async function verifyRegistration(): Promise<void> {
    await navigateTo(await registration.verify());
  }

  async function resendRegistrationCode(): Promise<void> {
    await registration.resend();
    notice.value = "Если регистрация активна, новый код отправлен.";
  }

  async function login(): Promise<void> {
    await identity.login();
    if (identity.sessionState.value === "error") {
      throw new Error(identity.sessionErrorMessage.value);
    }
  }

  async function requestRecovery(): Promise<void> {
    await identity.requestRecovery(identity.credentials.email);
    recoveryStep.value = "code";
    notice.value = "Если аккаунт с таким адресом существует, на него отправлен код восстановления.";
  }

  async function completeRecovery(): Promise<void> {
    await identity.completeRecovery(identity.credentials.email);
    mode.value = "login";
    recoveryStep.value = "email";
    notice.value = "Пароль изменён. Теперь войдите с новым паролем.";
  }

  async function logout(): Promise<void> {
    await identity.logout();
  }

  async function cancelAccountDeletion(currentPassword: string): Promise<void> {
    await identity.cancelAccountDeletion(currentPassword);
    notice.value =
      "Удаление аккаунта отменено. Теперь вы можете создать компанию или принять приглашение.";
  }

  function recoverPendingAccountPassword(): void {
    identity.credentials.email = identity.currentUser.value?.email ?? "";
    changeMode("recover");
  }

  function changeMode(nextMode: "landing" | "register" | "login" | "recover" | "company"): void {
    if (nextMode === "register") {
      registration.form.email = identity.credentials.email;
      registration.form.password = identity.credentials.password;
    } else if (mode.value === "register") {
      identity.credentials.email = registration.form.email;
      identity.credentials.password = registration.form.password;
    }
    mode.value = nextMode;
    registration.editDetails();
    recoveryStep.value = "email";
    errorMessage.value = "";
    notice.value = "";
  }

  function toggleMode(nextMode: "register" | "login" | "company"): void {
    changeMode(mode.value === nextMode ? "landing" : nextMode);
  }

  onMounted(initialize);

  watch(
    () => route.fullPath,
    async () => {
      if (identity.csrfToken.value) await identity.loadSession();
    },
  );

  return {
    identity,
    registration,
    companyForm,
    organizations,
    mode,
    recoveryStep,
    busy,
    errorMessage,
    formsDisabled: computed(() => busy.value || !identity.csrfToken.value),
    notice,
    run,
    submitRegistration,
    createCompany,
    verifyRegistration,
    resendRegistrationCode,
    login,
    requestRecovery,
    completeRecovery,
    logout,
    cancelAccountDeletion,
    recoverPendingAccountPassword,
    changeMode,
    toggleMode,
  };
}
