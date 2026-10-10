import {
  identityControllerLogin,
  invitationsControllerAccept,
  invitationsControllerCancelAcceptance,
  invitationsControllerCompleteExisting,
  invitationsControllerDecline,
  invitationsControllerCurrentInvitation,
  invitationsControllerPreviewInvitation,
  invitationsControllerStartRegistration,
  invitationsControllerResendRegistrationCode,
  invitationsControllerVerifyRegistration,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

type Invitation = {
  purpose: "JOIN_EXISTING_VENUE" | "JOIN_COMPANY_AS_CHEF";
  companyName: string;
  venueName: string | null;
  role: string | null;
  roleLabel: string;
  accessDescription: string | null;
  email: string;
  expiresAt: string;
};

export function useInvitationAcceptance() {
  const identity = useIdentityFlow();
  let invitationToken = "";
  const invitation = ref<Invitation | null>(null);
  const stage = ref<
    | "loading"
    | "preview"
    | "choose"
    | "register"
    | "verify"
    | "login"
    | "done"
    | "declined"
    | "missing"
  >("loading");
  const error = ref("");
  const busy = ref(false);
  const form = reactive({ fullName: "", password: "", email: "", code: "" });

  async function load(): Promise<void> {
    invitationToken = window.location.hash.slice(1);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );

    try {
      await identity.loadSession();

      if (invitationToken) {
        await identity.refreshCsrf();
        const preview = await requestApi<Invitation>(
          invitationsControllerPreviewInvitation(
            { token: invitationToken },
            identity.mutationOptions(),
            identity.apiFetch,
          ),
        );
        invitation.value = preview;
        form.email = preview.email;
        stage.value = "preview";
      } else {
        const current = await requestApi<{
          invitation: Invitation;
          registrationStarted: boolean;
        }>(invitationsControllerCurrentInvitation({ credentials: "include" }, identity.apiFetch));
        invitation.value = current.invitation;
        form.email = current.invitation.email;
        stage.value = current.registrationStarted ? "verify" : "choose";
      }
    } catch (cause) {
      if (!invitationToken) {
        stage.value = "missing";
        error.value = "Откройте ссылку из письма-приглашения, чтобы продолжить.";
      } else {
        stage.value = "preview";
        error.value = cause instanceof Error ? cause.message : "Приглашение недействительно";
      }
    }
  }

  async function accept(): Promise<void> {
    await run(async () => {
      await identity.refreshCsrf();
      await requestApi(
        invitationsControllerAccept(
          { token: invitationToken },
          identity.mutationOptions(),
          identity.apiFetch,
        ),
      );
      invitationToken = "";
      stage.value = "choose";
    });
  }

  async function decline(): Promise<void> {
    await run(async () => {
      await identity.refreshCsrf();
      await requestApi(
        invitationsControllerDecline(
          { token: invitationToken },
          identity.mutationOptions(),
          identity.apiFetch,
        ),
      );
      invitationToken = "";
      stage.value = "declined";
    });
  }

  async function startRegistration(): Promise<void> {
    await run(async () => {
      await identity.refreshCsrf();
      await requestApi(
        invitationsControllerStartRegistration(
          { fullName: form.fullName, password: form.password },
          identity.mutationOptions(),
          identity.apiFetch,
        ),
      );
      form.password = "";
      stage.value = "verify";
    });
  }

  async function verifyRegistration(): Promise<void> {
    await run(async () => {
      await identity.refreshCsrf();
      const result = await requestApi<{ redirectTo: string }>(
        invitationsControllerVerifyRegistration(
          { code: form.code },
          identity.mutationOptions(),
          identity.apiFetch,
        ),
      );
      stage.value = "done";
      await navigateTo(result.redirectTo, { replace: true });
    });
  }

  async function resendCode(): Promise<void> {
    await run(async () => {
      await identity.refreshCsrf();
      await requestApi(
        invitationsControllerResendRegistrationCode(identity.mutationOptions(), identity.apiFetch),
      );
    });
  }

  async function cancelAcceptance(): Promise<void> {
    await run(async () => {
      await identity.refreshCsrf();
      await requestApi(
        invitationsControllerCancelAcceptance(identity.mutationOptions(), identity.apiFetch),
      );
      stage.value = "done";
    });
  }

  async function loginAndJoin(): Promise<void> {
    await run(async () => {
      await identity.refreshCsrf();
      await requestApi(
        identityControllerLogin(
          { email: form.email, password: form.password },
          identity.mutationOptions(),
          identity.apiFetch,
        ),
      );
      const result = await requestApi<{ redirectTo: string }>(
        invitationsControllerCompleteExisting(identity.mutationOptions(), identity.apiFetch),
      );
      await navigateTo(result.redirectTo, { replace: true });
    });
  }

  async function completeCurrentAccount(): Promise<void> {
    await run(async () => {
      await identity.refreshCsrf();
      const result = await requestApi<{ redirectTo: string }>(
        invitationsControllerCompleteExisting(identity.mutationOptions(), identity.apiFetch),
      );
      await navigateTo(result.redirectTo, { replace: true });
    });
  }

  async function switchAccount(): Promise<void> {
    await run(async () => {
      await identity.refreshCsrf();
      await identity.logout();
      stage.value = "preview";
    });
  }

  async function run(action: () => Promise<void>): Promise<void> {
    busy.value = true;
    error.value = "";
    try {
      await action();
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Не удалось выполнить действие";
    } finally {
      busy.value = false;
    }
  }

  onMounted(load);

  return {
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
  };
}
