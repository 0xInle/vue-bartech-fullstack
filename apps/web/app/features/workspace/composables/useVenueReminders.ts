import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  remindersControllerCreate,
  remindersControllerDelete,
  remindersControllerList,
  remindersControllerSetCompleted,
} from "@bartech/api-client";
import type { VenueReminderDto } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export function useVenueReminders(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
) {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const userId = computed(() => identity.currentUser.value?.id ?? "");
  const queryKey = computed(() => [
    "venue-reminders",
    userId.value,
    toValue(companyId),
    toValue(venueId),
  ]);
  const remindersQuery = useQuery({
    queryKey,
    enabled: computed(() => Boolean(userId.value && toValue(companyId) && toValue(venueId))),
    retry: false,
    queryFn: async ({ signal }): Promise<VenueReminderDto[]> =>
      requestApi(
        Promise.resolve(
          await remindersControllerList(
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
    mutationFn: async (text: string) => {
      await identity.refreshCsrf();
      return requestApi(
        Promise.resolve(
          await remindersControllerCreate(
            toValue(companyId),
            toValue(venueId),
            { text },
            {
              credentials: "include",
              headers: { "x-csrf-token": identity.csrfToken.value },
            },
            identity.apiFetch,
          ),
        ),
      );
    },
    onSuccess: invalidate,
  });

  const completionMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      await identity.refreshCsrf();
      return requestApi(
        Promise.resolve(
          await remindersControllerSetCompleted(
            toValue(companyId),
            toValue(venueId),
            id,
            { completed },
            {
              credentials: "include",
              headers: { "x-csrf-token": identity.csrfToken.value },
            },
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
          await remindersControllerDelete(
            toValue(companyId),
            toValue(venueId),
            id,
            {
              credentials: "include",
              headers: { "x-csrf-token": identity.csrfToken.value },
            },
            identity.apiFetch,
          ),
        ),
      );
    },
    onSuccess: invalidate,
  });

  return { remindersQuery, createMutation, completionMutation, deleteMutation };
}
