export const PIN_DETAIL_PANEL_BREAKPOINT = 768;

export function shouldShowPinDetailPanel(viewportWidth: number, availableWidth = viewportWidth): boolean {
  return viewportWidth >= PIN_DETAIL_PANEL_BREAKPOINT && availableWidth >= 680;
}
