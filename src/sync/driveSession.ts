const TOKEN_KEY = 'sunburn.driveToken';
const EXP_KEY = 'sunburn.driveTokenExpires';

/** Access token from an earlier sign-in in this tab, if it has not expired. */
export function readDriveSession(now = Date.now()): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expires = Number(sessionStorage.getItem(EXP_KEY) || 0);
    if (!token || !Number.isFinite(expires) || now >= expires) return null;
    return token;
  } catch {
    return null;
  }
}

export function rememberDriveToken(token: string, expiresInSec: number, now = Date.now()): void {
  const lifetime = Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec : 3600;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    // Refresh a little early so a request does not start with a token that
    // expires mid-flight.
    sessionStorage.setItem(EXP_KEY, String(now + Math.max(0, lifetime - 30) * 1000));
  } catch {
    /* private mode */
  }
}

export function clearDriveSession(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXP_KEY);
  } catch {
    /* private mode */
  }
}
