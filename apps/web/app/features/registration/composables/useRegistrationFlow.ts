import {
  identityControllerResendRegistrationCode,
  identityControllerStartRegistration,
  identityControllerVerifyRegistration,
} from "@bartech/api-client";
import { requestApi } from "~/utils/api-response";

type RegistrationForm = {
  email: string;
  password: string;
  passwordConfirmation: string;
  fullName: string;
  companyName: string;
  venueName: string;
  code: string;
};

export function useRegistrationFlow(
  mutationOptions: () => RequestInit,
  apiFetch: typeof globalThis.fetch,
) {
  const step = ref<"details" | "code">("details");
  const form = reactive<RegistrationForm>({
    email: "",
    password: "",
    passwordConfirmation: "",
    fullName: "",
    companyName: "",
    venueName: "",
    code: "",
  });
  const passwordConfirmationError = ref("");

  watch([() => form.password, () => form.passwordConfirmation], () => {
    passwordConfirmationError.value = "";
  });

  async function begin(): Promise<boolean> {
    if (form.password !== form.passwordConfirmation) {
      passwordConfirmationError.value = "Пароли не совпадают.";
      return false;
    }

    await requestApi<{ accepted: true }>(
      identityControllerStartRegistration(
        {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          companyName: form.companyName,
          venueName: form.venueName,
        },
        mutationOptions(),
        apiFetch,
      ),
    );
    step.value = "code";
    form.code = "";
    return true;
  }

  async function verify(): Promise<string> {
    const result = await requestApi<{ redirectTo: string }>(
      identityControllerVerifyRegistration({ code: form.code }, mutationOptions(), apiFetch),
    );
    return result.redirectTo;
  }

  async function resend(): Promise<void> {
    await requestApi(identityControllerResendRegistrationCode(mutationOptions(), apiFetch));
  }

  function editDetails(): void {
    step.value = "details";
  }

  return { form, step, begin, verify, resend, editDetails, passwordConfirmationError };
}
