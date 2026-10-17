import { computed, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  exportsControllerCreateBackup,
  exportsControllerCreateBatch,
  exportsControllerCreateSingle,
  exportsControllerGetDownloadUrl,
  exportsControllerGetStatus,
} from "@bartech/api-client";
import type { CreateProductExportDto, ProductExportResponseDto } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export function useProductExports(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
  exportId: MaybeRefOrGetter<string>,
) {
  const queryClient = useQueryClient();
  const identity = useIdentityFlow();
  const company = computed(() => toValue(companyId));
  const venue = computed(() => toValue(venueId));
  const id = computed(() => toValue(exportId));
  const userId = computed(() => identity.currentUser.value?.id ?? "");

  watch([userId, company, venue], () => {
    void queryClient.removeQueries({ queryKey: ["product-export"] });
  });

  const statusQuery = useQuery<ProductExportResponseDto>({
    queryKey: computed(() => [
      "product-export",
      userId.value,
      company.value,
      venue.value,
      id.value,
    ]),
    enabled: computed(() => Boolean(userId.value && company.value && venue.value && id.value)),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "QUEUED" || query.state.data?.status === "PROCESSING"
        ? 2_000
        : false,
    queryFn: async ({ signal }): Promise<ProductExportResponseDto> =>
      requestApi(
        Promise.resolve(
          await exportsControllerGetStatus(
            company.value,
            venue.value,
            id.value,
            { credentials: "include", signal },
            identity.apiFetch,
          ),
        ),
      ),
  });

  async function createSingle(productId: string): Promise<string> {
    await identity.refreshCsrf();
    const result = await requestApi<ProductExportResponseDto>(
      Promise.resolve(
        await exportsControllerCreateSingle(
          company.value,
          venue.value,
          productId,
          {
            credentials: "include",
            headers: { "x-csrf-token": identity.csrfToken.value },
          },
          identity.apiFetch,
        ),
      ),
    );
    return result.id;
  }

  async function createBatch(input: CreateProductExportDto): Promise<string> {
    await identity.refreshCsrf();
    const result = await requestApi<ProductExportResponseDto>(
      Promise.resolve(
        await exportsControllerCreateBatch(
          company.value,
          venue.value,
          input,
          {
            credentials: "include",
            headers: { "x-csrf-token": identity.csrfToken.value },
          },
          identity.apiFetch,
        ),
      ),
    );
    return result.id;
  }

  async function createBackup(): Promise<string> {
    await identity.refreshCsrf();
    const result = await requestApi<ProductExportResponseDto>(
      Promise.resolve(
        await exportsControllerCreateBackup(
          company.value,
          venue.value,
          {
            credentials: "include",
            headers: { "x-csrf-token": identity.csrfToken.value },
          },
          identity.apiFetch,
        ),
      ),
    );
    return result.id;
  }

  async function download(): Promise<void> {
    const response = await requestApi<{ url: string }>(
      Promise.resolve(
        await exportsControllerGetDownloadUrl(
          company.value,
          venue.value,
          id.value,
          {
            credentials: "include",
          },
          identity.apiFetch,
        ),
      ),
    );
    window.location.assign(response.url);
  }

  async function open(id: string): Promise<void> {
    await navigateTo(`/app/companies/${company.value}/venues/${venue.value}/exports/${id}`);
  }

  return { createBackup, createBatch, createSingle, download, open, statusQuery };
}
