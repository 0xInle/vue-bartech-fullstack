import {
  identityControllerCompletePasswordRecovery,
  identityControllerCsrf,
  identityControllerLogin,
  identityControllerLogout,
  identityControllerLogoutAll,
  identityControllerRecoverPassword,
  identityControllerSession,
} from "@bartech/api-client";
import type { CurrentUser } from "~/types/user-workspaces";
import { requestApi } from "~/utils/api-response";

export function useIdentityFlow() {
  const apiFetch = useApiFetch();
  const csrfToken = ref("");
  const currentUser = ref<CurrentUser | null>(null);
  const sessionState = ref<"idle" | "loading" | "authenticated" | "unauthenticated" | "error">(
    "idle",
  );
  const sessionErrorMessage = ref("");
  const credentials = reactive({
    email: "",
    password: "",
    recoveryCode: "",
    newPassword: "",
  });

  function mutationOptions(): RequestInit {
    return { credentials: "include", headers: { "x-csrf-token": csrfToken.value } };
  }

  async function refreshCsrf(): Promise<void> {
    const result = await requestApi<{ token: string }>(
      identityControllerCsrf({ credentials: "include" }, apiFetch),
    );
    csrfToken.value = result.token;
  }

  async function loadSession(): Promise<void> {
    sessionState.value = "loading";
    sessionErrorMessage.value = "";
    try {
      const response = (await identityControllerSession({ credentials: "include" }, apiFetch)) as {
        status: number;
        data: unknown;
      };
      if (response.status === 401) {
        currentUser.value = null;
        sessionState.value = "unauthenticated";
        return;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error("Не удалось проверить сессию. Обновите страницу и попробуйте ещё раз.");
      }
      currentUser.value = response.data as CurrentUser;
      sessionState.value = "authenticated";
    } catch (error) {
      currentUser.value = null;
      sessionState.value = "error";
      sessionErrorMessage.value =
        error instanceof Error
          ? error.message
          : "Не удалось проверить сессию. Обновите страницу и попробуйте ещё раз.";
    }
  }

  async function login(): Promise<void> {
    await requestApi(
      identityControllerLogin(
        { email: credentials.email, password: credentials.password },
        mutationOptions(),
        apiFetch,
      ),
    );
    await loadSession();
  }

  async function requestRecovery(email: string): Promise<void> {
    await requestApi(identityControllerRecoverPassword({ email }, mutationOptions(), apiFetch));
  }

  async function completeRecovery(email: string): Promise<void> {
    await requestApi(
      identityControllerCompletePasswordRecovery(
        {
          email,
          code: credentials.recoveryCode,
          password: credentials.newPassword,
        },
        mutationOptions(),
        apiFetch,
      ),
    );
    credentials.password = "";
    credentials.recoveryCode = "";
  }

  async function logout(): Promise<void> {
    await requestApi(identityControllerLogout(mutationOptions(), apiFetch));
    currentUser.value = null;
    await loadSession();
  }

  async function logoutAll(): Promise<void> {
    await requestApi(identityControllerLogoutAll(mutationOptions(), apiFetch));
    currentUser.value = null;
    await loadSession();
  }

  return {
    apiFetch,
    credentials,
    csrfToken,
    currentUser,
    sessionState,
    sessionErrorMessage,
    loadSession,
    login,
    logout,
    logoutAll,
    mutationOptions,
    refreshCsrf,
    requestRecovery,
    completeRecovery,
  };
}
