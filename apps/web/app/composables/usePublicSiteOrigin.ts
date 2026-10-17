import { getPublicSiteOrigin } from "../../utils/publicSiteUrl";

export function usePublicSiteOrigin() {
  const config = useRuntimeConfig();

  return computed(() => getPublicSiteOrigin(config.public.siteUrl));
}
