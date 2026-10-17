export type GarnishListSort = "name" | "updated";

export type GarnishListItem = {
  id: string;
  name: string;
  componentSummary: string;
  updatedAt: Date;
};

export type GarnishCard = {
  id: string;
  name: string;
  type: "GARNISH";
  status: "ACTIVE";
  components: Array<{
    id: string;
    productId: string;
    productType: "INGREDIENT" | "PREPARATION";
    venueId: string | null;
    name: string;
    amount: number;
    unitId: string;
    unit: string;
  }>;
  technology: string;
  output: { amount: number; unitId: string; unit: string } | null;
  comment: string | null;
};
