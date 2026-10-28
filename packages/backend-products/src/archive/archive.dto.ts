import type { ProductStatus, ProductType } from "@bartech/database";

export type ArchiveProductSummary = { id: string; type: ProductType; name: string };
export type ArchiveLink = {
  id: string;
  productId: string;
  productType: ProductType;
  name: string;
  status: ProductStatus;
  amount: number;
  unitId: string;
  unit: string;
};
export type ArchiveCard = ArchiveProductSummary & {
  status: "ARCHIVED";
  updatedAt: Date;
  technology: string | null;
  comment: string | null;
  category: string | null;
  brand: string | null;
  strength: number | null;
  country: string | null;
  externalIdentifier: string | null;
  components: ArchiveLink[];
  garnishes: Array<
    | (ArchiveProductSummary & { kind: "PRODUCT"; status: ProductStatus })
    | { id: string; type: "QUICK"; name: string; kind: "QUICK"; status: null }
  >;
  output: { amount: number; unitId: string; unit: string } | null;
  glass: string | null;
  ice: string | null;
  preparationMethod: string | null;
};
export type ArchiveRestoreNode = ArchiveProductSummary & {
  parentIds: string[];
  nameConflict: boolean;
  replacements: ArchiveProductSummary[];
};
export type ArchiveRestorePlan = {
  root: ArchiveProductSummary & { nameConflict: boolean };
  dependencies: ArchiveRestoreNode[];
  confirmationFingerprint: string;
};
export type ArchiveRestoreInput = {
  confirmationFingerprint: string;
  newName?: string;
  decisions: Array<{
    productId: string;
    action: "RESTORE" | "REPLACE";
    replacementProductId?: string;
    newName?: string;
  }>;
};
