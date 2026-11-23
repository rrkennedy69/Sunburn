/**
 * Google Identity Services token client.
 * Same approach as PrintCaddy: load https://accounts.google.com/gsi/client,
 * request an access token for the Drive app-data folder, and never handle a
 * client secret in the browser.
 */

import { rememberDriveToken } from './driveSession';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }): { requestAccessToken: (options?: { prompt?: string }) => void };
        };
      };
    };
  }
}

function gisReady(): boolean {
  return !!window.google?.accounts?.oauth2;
}

export function loadGoogleIdentity(): Promise<void> {
  if (gisReady()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearInterval(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = window.setInterval(() => {
      if (gisReady()) finish();
    }, 100);
    window.setTimeout(() => finish(new Error('Could not load Google sign-in.')), 8000);

    if (document.querySelector(`script[src="${GIS_SRC}"]`)) return;
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onerror = () => finish(new Error('Could not load Google sign-in.'));
    document.head.appendChild(script);
  });
}

export async function requestDriveToken(clientId: string, prompt: '' | 'none' = ''): Promise<string> {
  await loadGoogleIdentity();
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) throw new Error('Google sign-in did not load.');

  return new Promise((resolve, reject) => {
    let client: { requestAccessToken: (options?: { prompt?: string }) => void };
    try {
      client = oauth.initTokenClient({
        client_id: clientId,
        scope: DRIVE_APPDATA_SCOPE,
        callback: (response) => {
          if (response.access_token) {
            const expires = Number(response.expires_in);
            rememberDriveToken(
              response.access_token,
              Number.isFinite(expires) && expires > 0 ? expires : 3600,
            );
            resolve(response.access_token);
            return;
          }
          if (response.error === 'origin_mismatch') {
            reject(
              new Error(
                'Google refused this site. Add this page’s address as an authorized JavaScript origin on the OAuth client.',
              ),
            );
            return;
          }
          reject(
            new Error(
              response.error
                ? `Google sign-in failed (${response.error}).`
                : 'Google sign-in did not return a token.',
            ),
          );
        },
        error_callback: () => {
          reject(new Error('Google sign-in was closed before a token was granted.'));
        },
      });
    } catch {
      reject(
        new Error(
          'Google refused to start sign-in. Add this page’s address as an authorized JavaScript origin on the OAuth client.',
        ),
      );
      return;
    }
    client.requestAccessToken({ prompt });
  });
}
