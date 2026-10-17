export type PreparationListSort = "name" | "updated";

export type PreparationListItem = {
  id: string;
  name: string;
  categoryName: string;
  componentSummary: string;
  updatedAt: Date;
};

export type PreparationCard = {
  id: string;
  name: string;
  type: "PREPARATION";
  status: "ACTIVE";
  categoryCode: string;
  categoryName: string;
  components: Array<{
    id: string;
    productId: string;
    productType: "INGREDIENT" | "PREPARATION";
    name: string;
    amount: number;
    unitId: string;
    unit: string;
  }>;
  technology: string;
  output: { amount: number; unitId: string; unit: string } | null;
  comment: string | null;
};
