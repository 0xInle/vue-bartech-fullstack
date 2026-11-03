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
  nameConflict: boolean;
};
export type ArchiveRestorePlan = {
  root: ArchiveProductSummary & { nameConflict: boolean };
  dependencies: ArchiveRestoreNode[];
  confirmationFingerprint: string;
};
export type ArchiveRestoreInput = {
  confirmationFingerprint: string;
  names: Array<{
    productId: string;
    name: string;
  }>;
};

export type PermanentDeleteUsage = {
  id: string;
  parentId: string;
  parentType: ProductType;
  parentName: string;
  parentStatus: ProductStatus;
  relation: "COMPONENT" | "GARNISH";
  replacements: ArchiveProductSummary[];
};

export type PermanentDeleteProduct = ArchiveProductSummary & {
  status: ProductStatus;
};

export type PermanentDeletePlan = {
  root: PermanentDeleteProduct;
  activeUsages: PermanentDeleteUsage[];
  archivedUsages: PermanentDeleteUsage[];
  deleteChain: PermanentDeleteProduct[];
  confirmationFingerprint: string;
};

export type PermanentDeleteInput = {
  action: "DELETE" | "REPLACE" | "DELETE_CHAIN";
  confirmationFingerprint: string;
  confirmationName?: string;
  replacementProductId?: string;
};

export type ArchivePlan = Omit<PermanentDeletePlan, "deleteChain"> & {
  archiveChain: PermanentDeleteProduct[];
  canReplace: boolean;
};
export type ArchiveInput = {
  action: "ARCHIVE" | "REPLACE" | "ARCHIVE_CHAIN";
  confirmationFingerprint: string;
  confirmationName?: string;
  replacementProductId?: string;
};
