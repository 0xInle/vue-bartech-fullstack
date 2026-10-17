import { getPublicSiteOrigin } from "../../utils/publicSiteUrl";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const origin = getPublicSiteOrigin(config.public.siteUrl);
  const urls = origin ? ["/", "/docs"].map((path) => `${origin}${path}`) : [];
  const entries = urls.map((url) => `<url><loc>${url}</loc></url>`).join("");

  setHeader(event, "content-type", "application/xml; charset=utf-8");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
});
