import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { readResponse } from "./useSupportConversation";

export type SupportUnreadCount = {
  totalCount: number;
  requests: Array<{ requestId: string; unreadCount: number }>;
};

export function useSupportUnreadCount() {
  const identity = useIdentityFlow();
  const userId = computed(() => identity.currentUser.value?.id ?? "");
  const apiFetch = useApiFetch();
  return useQuery<SupportUnreadCount>({
    queryKey: computed(() => ["support-unread-count", userId.value]),
    enabled: computed(() => Boolean(userId.value)),
    retry: false,
    refetchInterval: 60_000,
    queryFn: async ({ signal }) =>
      readResponse(
        await apiFetch("/api/v1/support/requests/unread-count", { credentials: "include", signal }),
      ),
  });
}
