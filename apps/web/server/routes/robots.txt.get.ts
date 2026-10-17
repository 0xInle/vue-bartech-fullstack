import { getPublicSiteOrigin } from "../../utils/publicSiteUrl";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const origin = getPublicSiteOrigin(config.public.siteUrl);
  const sitemapLine = origin ? `Sitemap: ${origin}/sitemap.xml\n` : "";

  setHeader(event, "content-type", "text/plain; charset=utf-8");

  return `User-agent: *\nAllow: /\n${sitemapLine}`;
});
