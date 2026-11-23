import { afterEach, describe, expect, it } from 'vitest';
import { requestDriveToken } from './googleAuth';
import { clearDriveSession, readDriveSession, rememberDriveToken } from './driveSession';

afterEach(() => {
  clearDriveSession();
  delete (window as { google?: unknown }).google;
});

describe('drive session', () => {
  it('remembers a token until it expires', () => {
    const now = 1_700_000_000_000;
    rememberDriveToken('token-1', 100, now);
    expect(readDriveSession(now + 60_000)).toBe('token-1');
    expect(readDriveSession(now + 80_000)).toBeNull();
  });

  it('stores the token returned by Google sign-in', async () => {
    let prompt: string | undefined;
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient(config) {
            return {
              requestAccessToken(options) {
                prompt = options?.prompt;
                config.callback({ access_token: 'from-google', expires_in: 120 });
              },
            };
          },
        },
      },
    };

    await expect(requestDriveToken('client.apps.googleusercontent.com', 'none')).resolves.toBe(
      'from-google',
    );
    expect(prompt).toBe('none');
    expect(readDriveSession()).toBe('from-google');
  });
});
