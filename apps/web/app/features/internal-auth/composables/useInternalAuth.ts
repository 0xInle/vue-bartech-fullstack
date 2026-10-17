import {
  identityControllerCsrf,
  internalAuthControllerCompleteSetup,
  internalAuthControllerLogin,
  internalAuthControllerLogout,
  internalAuthControllerLogoutAll,
  internalAuthControllerRecovery,
  internalAuthControllerRecoveryComplete,
  internalAuthControllerRecoverySetup,
  internalAuthControllerSession,
  internalAuthControllerSetup,
  internalAuthControllerVerifyLogin,
} from "@bartech/api-client";

type InternalSession = { user: { id: string; email: string; permissions: string[] } };

function unwrap<T>(response: { status: number; data: T }): T {
  if (response.status < 200 || response.status >= 300) {
    const data = response.data as { detail?: string } | undefined;
    throw new Error(data?.detail ?? "Не удалось выполнить запрос");
  }
  return response.data;
}

export function useInternalAuth() {
  const apiFetch = useApiFetch();
  const csrfToken = ref("");
  const state = reactive({
    email: "",
    password: "",
    code: "",
    recoveryCode: "",
    setupToken: "",
    challenge: "",
    secret: "",
    qrCodeDataUrl: "",
    recoveryCodes: [] as string[],
    user: null as InternalSession["user"] | null,
    busy: false,
    error: "",
  });

  function mutationOptions(): RequestInit {
    return { credentials: "include", headers: { "x-csrf-token": csrfToken.value } };
  }

  async function refreshCsrf(): Promise<void> {
    const result = unwrap(await identityControllerCsrf({ credentials: "include" }, apiFetch));
    csrfToken.value = result.token;
  }

  async function perform(operation: () => Promise<void>): Promise<void> {
    state.busy = true;
    state.error = "";
    try {
      if (!csrfToken.value) await refreshCsrf();
      await operation();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Не удалось выполнить запрос";
    } finally {
      state.busy = false;
    }
  }

  async function login(): Promise<void> {
    await perform(async () => {
      const result = unwrap(
        await internalAuthControllerLogin(
          { email: state.email, password: state.password },
          mutationOptions(),
          apiFetch,
        ),
      );
      state.challenge = result.challenge;
      state.password = "";
      state.code = "";
    });
  }

  async function verifyLogin(): Promise<void> {
    await perform(async () => {
      unwrap(
        await internalAuthControllerVerifyLogin(
          { challenge: state.challenge, code: state.code },
          mutationOptions(),
          apiFetch,
        ),
      );
      state.challenge = "";
      state.code = "";
      await loadSession();
    });
  }

  async function startSetup(recovery = false): Promise<void> {
    await perform(async () => {
      const options = mutationOptions();
      const result = unwrap(
        recovery
          ? await internalAuthControllerRecoverySetup(
              { setupToken: state.setupToken },
              options,
              apiFetch,
            )
          : await internalAuthControllerSetup({ setupToken: state.setupToken }, options, apiFetch),
      );
      state.challenge = result.challenge;
      state.secret = result.secret;
      state.qrCodeDataUrl = result.qrCodeDataUrl;
      state.setupToken = "";
      state.code = "";
    });
  }

  async function completeSetup(recovery = false): Promise<void> {
    await perform(async () => {
      const options = mutationOptions();
      const result = unwrap(
        recovery
          ? await internalAuthControllerRecoveryComplete(
              { challenge: state.challenge, code: state.code },
              options,
              apiFetch,
            )
          : await internalAuthControllerCompleteSetup(
              { challenge: state.challenge, code: state.code, password: state.password },
              options,
              apiFetch,
            ),
      );
      state.recoveryCodes = result.recoveryCodes;
      state.password = "";
      state.code = "";
      state.challenge = "";
    });
  }

  async function recover(): Promise<void> {
    await perform(async () => {
      const result = unwrap(
        await internalAuthControllerRecovery(
          { email: state.email, password: state.password, recoveryCode: state.recoveryCode },
          mutationOptions(),
          apiFetch,
        ),
      );
      state.challenge = result.challenge;
      state.password = "";
      state.recoveryCode = "";
    });
  }

  async function loadSession(): Promise<void> {
    try {
      const result = unwrap(
        await internalAuthControllerSession({ credentials: "include" }, apiFetch),
      );
      state.user = result.user;
    } catch {
      state.user = null;
    }
  }

  async function logout(all = false): Promise<void> {
    await perform(async () => {
      const options = mutationOptions();
      if (all) unwrap(await internalAuthControllerLogoutAll(options, apiFetch));
      else unwrap(await internalAuthControllerLogout(options, apiFetch));
      state.user = null;
    });
  }

  return { state, login, verifyLogin, startSetup, completeSetup, recover, loadSession, logout };
}
