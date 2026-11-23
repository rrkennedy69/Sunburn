import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetDiscardGuard, resolveDiscardConfirmation } from '@/state/discardGuard';
import { confirmLeaveToHome } from '@/state/homeNavigation';
import { store } from '@/state/store';
import { MenuBar } from './MenuBar';

afterEach(() => {
  resetDiscardGuard();
  store.setState({ dirty: false });
});

describe('editor sun mark', () => {
  it('goes home after the user discards unsaved changes, and stays if they cancel', async () => {
    store.setState({ dirty: true });
    let wentHome = false;
    const onHome = () => {
      void confirmLeaveToHome().then((ok) => {
        if (ok) wentHome = true;
      });
    };
    window.addEventListener('openburn:home', onHome);
    render(<MenuBar />);

    await userEvent.click(screen.getByRole('button', { name: 'SunBurn home' }));
    await act(async () => {
      resolveDiscardConfirmation(false);
    });
    await waitFor(() => expect(store.getState().dirty).toBe(true));
    expect(wentHome).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'SunBurn home' }));
    await act(async () => {
      resolveDiscardConfirmation(true);
    });
    await waitFor(() => expect(wentHome).toBe(true));
    expect(store.getState().dirty).toBe(false);

    window.removeEventListener('openburn:home', onHome);
  });
});
