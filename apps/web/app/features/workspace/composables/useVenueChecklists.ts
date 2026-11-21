import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  checklistsControllerCreate,
  checklistsControllerDelete,
  checklistsControllerList,
  checklistsControllerUpdate,
} from "@bartech/api-client";
import type { SaveVenueChecklistDto, VenueChecklistDto } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export function useVenueChecklists(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
) {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const userId = computed(() => identity.currentUser.value?.id ?? "");
  const queryKey = computed(() => [
    "venue-checklists",
    userId.value,
    toValue(companyId),
    toValue(venueId),
  ]);
  const checklistsQuery = useQuery({
    queryKey,
    enabled: computed(() => Boolean(userId.value && toValue(companyId) && toValue(venueId))),
    retry: false,
    queryFn: async ({ signal }): Promise<VenueChecklistDto[]> =>
      requestApi(
        Promise.resolve(
          await checklistsControllerList(
            toValue(companyId),
            toValue(venueId),
            { credentials: "include", signal },
            identity.apiFetch,
          ),
        ),
      ),
  });

  async function invalidate(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKey.value, exact: true });
  }

  const createMutation = useMutation({
    mutationFn: async (input: SaveVenueChecklistDto) => {
      await identity.refreshCsrf();
      return requestApi(
        Promise.resolve(
          await checklistsControllerCreate(
            toValue(companyId),
            toValue(venueId),
            input,
            { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
            identity.apiFetch,
          ),
        ),
      );
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SaveVenueChecklistDto }) => {
      await identity.refreshCsrf();
      return requestApi(
        Promise.resolve(
          await checklistsControllerUpdate(
            toValue(companyId),
            toValue(venueId),
            id,
            input,
            { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
            identity.apiFetch,
          ),
        ),
      );
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await identity.refreshCsrf();
      return requestApi(
        Promise.resolve(
          await checklistsControllerDelete(
            toValue(companyId),
            toValue(venueId),
            id,
            { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
            identity.apiFetch,
          ),
        ),
      );
    },
    onSuccess: invalidate,
  });

  return { checklistsQuery, createMutation, updateMutation, deleteMutation };
}
