/** How long after a PIN reset the previous hashed PIN can be restored. */
export const PIN_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isPinUndoWithinWindow(
  pinResetAt: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!pinResetAt) return false;
  const resetMs = Date.parse(pinResetAt);
  if (Number.isNaN(resetMs)) return false;
  return nowMs - resetMs <= PIN_UNDO_WINDOW_MS;
}
