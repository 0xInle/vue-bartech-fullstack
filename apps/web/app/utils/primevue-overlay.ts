export type PrimeVueOverlayRef = {
  $el?: HTMLElement | null;
  hide?: () => void;
  unbindScrollListener?: () => void;
};

export function keepPrimeVueOverlayOpenOnScroll(
  overlay: PrimeVueOverlayRef | null | undefined,
): void {
  overlay?.unbindScrollListener?.();
}

export function keepPrimeVueOverlayWithinDrawer(
  component: PrimeVueOverlayRef | null | undefined,
): void {
  const root = component?.$el;
  if (!root) return;

  requestAnimationFrame(() => {
    const overlay = root.querySelector<HTMLElement>(
      ".p-select-overlay, .p-multiselect-overlay, .p-autocomplete-overlay",
    );
    const drawer = root.closest<HTMLElement>(".p-drawer");
    if (!overlay || !drawer) return;

    const drawerRect = drawer.getBoundingClientRect();
    const maxWidth = drawerRect.width;
    if (overlay.getBoundingClientRect().width > maxWidth) {
      overlay.style.maxWidth = `${maxWidth}px`;
      overlay.style.overflowX = "auto";
    }

    const overlayRect = overlay.getBoundingClientRect();
    const rightOverflow = Math.max(0, overlayRect.right - drawerRect.right);
    const availableLeft = Math.max(0, overlayRect.left - drawerRect.left);
    const shiftLeft = Math.min(rightOverflow, availableLeft);

    if (shiftLeft > 0) {
      const currentLeft = Number.parseFloat(overlay.style.left) || 0;
      overlay.style.left = `${currentLeft - shiftLeft}px`;
    }
  });
}
