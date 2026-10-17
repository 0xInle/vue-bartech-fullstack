import type { ProductAnalyticsEventDto } from "@bartech/api-client";

export function analyticsDeviceType(): ProductAnalyticsEventDto["deviceType"] {
  const userAgent = navigator.userAgent;
  if (
    /iPad|Tablet|PlayBook|Silk/i.test(userAgent) ||
    (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))
  ) {
    return "TABLET";
  }
  if (/Mobi|iPhone|iPod|Android.*Mobile/i.test(userAgent)) return "MOBILE";
  return "DESKTOP";
}
