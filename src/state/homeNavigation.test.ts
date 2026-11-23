import { afterEach, describe, expect, it } from 'vitest';
import { resetDiscardGuard, resolveDiscardConfirmation } from './discardGuard';
import { confirmLeaveToHome } from './homeNavigation';
import { store } from './store';

afterEach(() => {
  resetDiscardGuard();
  store.setState({ dirty: false });
});

describe('confirmLeaveToHome', () => {
  it('continues immediately when the project is clean', async () => {
    store.setState({ dirty: false });
    await expect(confirmLeaveToHome()).resolves.toBe(true);
  });

  it('stays in the editor when the user cancels', async () => {
    store.setState({ dirty: true });
    const pending = confirmLeaveToHome();
    resolveDiscardConfirmation(false);
    await expect(pending).resolves.toBe(false);
    expect(store.getState().dirty).toBe(true);
  });

  it('clears the unsaved flag when the user discards', async () => {
    store.setState({ dirty: true });
    const pending = confirmLeaveToHome();
    resolveDiscardConfirmation(true);
    await expect(pending).resolves.toBe(true);
    expect(store.getState().dirty).toBe(false);
  });

  it('keeps a saved project clean', async () => {
    store.setState({ dirty: true });
    const pending = confirmLeaveToHome();
    store.setState({ dirty: false });
    resolveDiscardConfirmation(true);
    await expect(pending).resolves.toBe(true);
    expect(store.getState().dirty).toBe(false);
  });
});
