import { requestDiscardConfirmation } from './discardGuard';
import { store } from './store';

/**
 * Leave the editor for the home screen.
 * A clean project continues immediately. Save and Discard both continue;
 * Cancel stays in the editor. Discard drops the unsaved flag so the next
 * open or new project does not ask again.
 */
export async function confirmLeaveToHome(): Promise<boolean> {
  const ok = await requestDiscardConfirmation();
  if (!ok) return false;
  if (store.getState().dirty) store.markDirty(false);
  return true;
}
