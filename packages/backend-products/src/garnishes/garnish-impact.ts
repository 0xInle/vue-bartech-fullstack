import { createHash } from "node:crypto";

export type GarnishImpactItem = { id: string; type: "COCKTAIL"; name: string };

export function garnishImpactFingerprint(
  venueId: string,
  garnishId: string,
  input: unknown,
  affectedProducts: GarnishImpactItem[],
): string {
  return createHash("sha256")
    .update(JSON.stringify({ venueId, garnishId, input, affectedProducts }))
    .digest("hex");
}
