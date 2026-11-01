export type WorkspaceProductDrawerTarget = {
  id: string;
  status: "ACTIVE" | "ARCHIVED";
  type: "COCKTAIL" | "GARNISH" | "PREPARATION";
};

export function useWorkspaceProductDrawer() {
  const target = useState<WorkspaceProductDrawerTarget | null>(
    "workspace-product-drawer-target",
    () => null,
  );

  function open(nextTarget: WorkspaceProductDrawerTarget): void {
    target.value = nextTarget;
  }

  function close(): void {
    target.value = null;
  }

  return { close, open, target };
}
