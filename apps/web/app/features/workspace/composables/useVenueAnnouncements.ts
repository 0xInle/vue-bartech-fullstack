import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  announcementsControllerCreate,
  announcementsControllerDelete,
  announcementsControllerList,
  announcementsControllerUpdate,
} from "@bartech/api-client";
import type { SaveVenueAnnouncementDto, VenueAnnouncementDto } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export function useVenueAnnouncements(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
) {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const userId = computed(() => identity.currentUser.value?.id ?? "");
  const queryKey = computed(() => [
    "venue-announcements",
    userId.value,
    toValue(companyId),
    toValue(venueId),
  ]);

  const announcementsQuery = useQuery({
    queryKey,
    enabled: computed(() => Boolean(userId.value && toValue(companyId) && toValue(venueId))),
    retry: false,
    queryFn: async ({ signal }): Promise<VenueAnnouncementDto[]> =>
      requestApi(
        Promise.resolve(
          await announcementsControllerList(
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
    mutationFn: async (input: SaveVenueAnnouncementDto) => {
      await identity.refreshCsrf();
      return requestApi(
        Promise.resolve(
          await announcementsControllerCreate(
            toValue(companyId),
            toValue(venueId),
            input,
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SaveVenueAnnouncementDto }) => {
      await identity.refreshCsrf();
      return requestApi(
        Promise.resolve(
          await announcementsControllerUpdate(
            toValue(companyId),
            toValue(venueId),
            id,
            input,
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
          await announcementsControllerDelete(
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

  return { announcementsQuery, createMutation, updateMutation, deleteMutation };
}
