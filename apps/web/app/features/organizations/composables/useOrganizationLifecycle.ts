import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import {
  organizationsControllerBeginCompanyClosure,
  organizationsControllerCancelCompanyClosure,
  organizationsControllerCloseVenue,
  organizationsControllerGetCompanyClosure,
  organizationsControllerGetLeaveAndCloseAvailability,
  organizationsControllerLeaveAndCloseVenue,
  organizationsControllerPrepareCompanyClosure,
  organizationsControllerPrepareVenueClosure,
} from "@bartech/api-client";
import type { CompanyClosureResponseDto } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

type ApiResult = { data: unknown; status: number };

export function useOrganizationLifecycle(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string> = () => "",
) {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const closureQuery = useQuery({
    queryKey: computed(() => ["organization-closure", toValue(companyId)]),
    enabled: computed(
      () => Boolean(toValue(companyId)) && identity.sessionState.value === "authenticated",
    ),
    retry: false,
    queryFn: async ({ signal }) => {
      return requestApi<CompanyClosureResponseDto>(
        organizationsControllerGetCompanyClosure(
          toValue(companyId),
          { credentials: "include", signal },
          identity.apiFetch,
        ),
      );
    },
  });
  const leaveAndCloseQuery = useQuery({
    queryKey: computed(() => ["venue-leave-and-close", toValue(companyId), toValue(venueId)]),
    enabled: computed(
      () =>
        Boolean(toValue(companyId) && toValue(venueId)) &&
        identity.sessionState.value === "authenticated",
    ),
    retry: false,
    queryFn: async ({ signal }) =>
      requestApi<{ available: boolean }>(
        organizationsControllerGetLeaveAndCloseAvailability(
          toValue(companyId),
          toValue(venueId),
          { credentials: "include", signal },
          identity.apiFetch,
        ),
      ),
  });

  async function refreshState<T extends ApiResult>(result: Promise<T>) {
    const response = await requestApi<T>(result);
    await queryClient.invalidateQueries({ queryKey: ["organization-closure", toValue(companyId)] });
    return response;
  }

  async function prepareVenueClosure(venueId: string) {
    if (!identity.csrfToken.value) await identity.refreshCsrf();
    return requestApi(
      organizationsControllerPrepareVenueClosure(
        toValue(companyId),
        venueId,
        identity.mutationOptions(),
        identity.apiFetch,
      ),
    );
  }

  async function prepareCompanyClosure() {
    if (!identity.csrfToken.value) await identity.refreshCsrf();
    return requestApi(
      organizationsControllerPrepareCompanyClosure(
        toValue(companyId),
        identity.mutationOptions(),
        identity.apiFetch,
      ),
    );
  }

  async function closeVenue(
    venueId: string,
    confirmationName: string,
    operationId: string,
    exportRequestId?: string,
    withoutExport = false,
  ) {
    if (!identity.csrfToken.value) await identity.refreshCsrf();
    return refreshState(
      organizationsControllerCloseVenue(
        toValue(companyId),
        venueId,
        { confirmationName, operationId, exportRequestId, withoutExport },
        identity.mutationOptions(),
        identity.apiFetch,
      ),
    );
  }

  async function leaveAndCloseVenue(
    venueId: string,
    confirmationName: string,
    operationId: string,
    exportRequestId?: string,
    withoutExport = false,
  ) {
    if (!identity.csrfToken.value) await identity.refreshCsrf();
    const result = await refreshState(
      organizationsControllerLeaveAndCloseVenue(
        toValue(companyId),
        venueId,
        { confirmationName, operationId, exportRequestId, withoutExport },
        identity.mutationOptions(),
        identity.apiFetch,
      ),
    );
    await queryClient.invalidateQueries({
      queryKey: ["venue-leave-and-close", toValue(companyId), toValue(venueId)],
    });
    return result;
  }

  async function beginCompanyClosure(
    confirmationName: string,
    operationId: string | undefined,
    withoutExport: boolean,
  ) {
    if (!identity.csrfToken.value) await identity.refreshCsrf();
    return refreshState(
      organizationsControllerBeginCompanyClosure(
        toValue(companyId),
        { confirmationName, operationId, withoutExport },
        identity.mutationOptions(),
        identity.apiFetch,
      ),
    );
  }

  async function cancelCompanyClosure() {
    if (!identity.csrfToken.value) await identity.refreshCsrf();
    return refreshState(
      organizationsControllerCancelCompanyClosure(
        toValue(companyId),
        identity.mutationOptions(),
        identity.apiFetch,
      ),
    );
  }

  return {
    closureQuery,
    leaveAndCloseQuery,
    prepareVenueClosure,
    prepareCompanyClosure,
    closeVenue,
    leaveAndCloseVenue,
    beginCompanyClosure,
    cancelCompanyClosure,
  };
}
