import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StoredProject } from '@/state/projectLibrary';
import { formatProjectDate } from './formatProjectDate';
import { HomeScreen } from './HomeScreen';

const localProject: StoredProject = {
  id: 'doc:1',
  name: 'Maple sign',
  modifiedAt: '2026-06-15T12:00:00.000Z',
  thumbnail: 'data:image/svg+xml,maple',
  document: { format: 'openburn' } as StoredProject['document'],
  filePath: null,
};

const driveProject: StoredProject = {
  id: 'drive:coaster',
  name: 'Coaster',
  modifiedAt: '2026-07-01T12:00:00.000Z',
  thumbnail: 'data:image/svg+xml,coaster',
  document: { format: 'openburn' } as StoredProject['document'],
  filePath: null,
};

function renderHome(
  overrides: Partial<{
    loadLocal: () => Promise<StoredProject[]>;
    loadDrive: (token: string) => Promise<StoredProject[]>;
    requestToken: (clientId: string, prompt: '' | 'none') => Promise<string>;
    readSession: () => string | null;
    readClientId: () => string;
  }> = {},
) {
  const onNew = vi.fn();
  const onOpenFile = vi.fn();
  const onOpenLocal = vi.fn();
  const onOpenDrive = vi.fn();
  render(
    <HomeScreen
      ready
      onNew={onNew}
      onOpenFile={onOpenFile}
      onOpenLocal={onOpenLocal}
      onOpenDrive={onOpenDrive}
      loadLocal={overrides.loadLocal ?? (async () => [])}
      loadDrive={overrides.loadDrive ?? (async () => [])}
      requestToken={overrides.requestToken ?? (async () => 'token')}
      readSession={overrides.readSession ?? (() => null)}
      readClientId={overrides.readClientId ?? (() => '')}
      writeClientId={() => undefined}
    />,
  );
  return { onNew, onOpenFile, onOpenLocal, onOpenDrive };
}

describe('ui/HomeScreen', () => {
  it('opens a saved project and starts a new one', async () => {
    const { onNew, onOpenFile, onOpenLocal } = renderHome({
      loadLocal: async () => [localProject],
    });

    expect(await screen.findByRole('heading', { name: 'SunBurn' })).toBeInTheDocument();
    const card = await screen.findByRole('button', { name: /Maple sign/ });
    expect(card.querySelector('img')).toHaveAttribute('src', localProject.thumbnail);
    expect(screen.getByText(formatProjectDate(localProject.modifiedAt))).toBeInTheDocument();

    await userEvent.click(card);
    expect(onOpenLocal).toHaveBeenCalledWith(localProject);

    await userEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(onNew).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Open from disk' }));
    expect(onOpenFile).toHaveBeenCalled();
  });

  it('lists Drive projects when a session is already stored', async () => {
    const { onOpenDrive } = renderHome({
      readSession: () => 'stored-token',
      loadDrive: async (token) => {
        expect(token).toBe('stored-token');
        return [driveProject];
      },
    });

    await userEvent.click(await screen.findByRole('button', { name: /Coaster/ }));
    expect(onOpenDrive).toHaveBeenCalledWith(driveProject);
  });

  it('signs in and then lists Drive projects', async () => {
    const requestToken = vi.fn(async (_id: string, prompt: '' | 'none') => {
      if (prompt === 'none') throw new Error('not signed in');
      return 'fresh-token';
    });
    const loadDrive = vi.fn(async () => [driveProject]);
    renderHome({
      readClientId: () => 'sun.apps.googleusercontent.com',
      requestToken,
      loadDrive,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in to Google Drive' }));
    expect(await screen.findByRole('button', { name: /Coaster/ })).toBeInTheDocument();
    expect(requestToken).toHaveBeenCalledWith('sun.apps.googleusercontent.com', '');
    expect(loadDrive).toHaveBeenCalledWith('fresh-token');
  });

  it('asks for a client id before signing in', async () => {
    const requestToken = vi.fn();
    renderHome({ requestToken });

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in to Google Drive' }));
    expect(screen.getByText(/Add a Google OAuth client ID/)).toBeInTheDocument();
    expect(requestToken).not.toHaveBeenCalled();
  });
});
