import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { auditControllerList, auditControllerListAuthors } from "@bartech/api-client";
import type {
  AuditHistoryAuthorHttpDto,
  AuditEventHttpDto,
  AuditHistoryPageHttpDto,
  AuditControllerListAuthorsParams,
  AuditControllerListParams,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export type AuditEvent = AuditEventHttpDto;

export function useAuditHistory(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<AuditControllerListParams>,
  authorParams: MaybeRefOrGetter<AuditControllerListAuthorsParams>,
) {
  const identity = useIdentityFlow();
  const company = computed(() => toValue(companyId));
  const venue = computed(() => toValue(venueId));
  const filters = computed(() => toValue(params));
  const authorFilters = computed(() => toValue(authorParams));

  const historyQuery = useQuery({
    queryKey: computed(() => ["audit-history", company.value, venue.value, filters.value]),
    enabled: computed(() => Boolean(company.value && venue.value)),
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await auditControllerList(
        company.value,
        venue.value,
        filters.value,
        { credentials: "include", signal },
        identity.apiFetch,
      );
      return requestApi<AuditHistoryPageHttpDto>(Promise.resolve(response));
    },
  });

  const authorsQuery = useQuery({
    queryKey: computed(() => [
      "audit-history-authors",
      company.value,
      venue.value,
      authorFilters.value,
    ]),
    enabled: computed(() => Boolean(company.value && venue.value)),
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await auditControllerListAuthors(
        company.value,
        venue.value,
        authorFilters.value,
        { credentials: "include", signal },
        identity.apiFetch,
      );
      return requestApi<AuditHistoryAuthorHttpDto[]>(Promise.resolve(response));
    },
  });

  return { historyQuery, authorsQuery };
}
