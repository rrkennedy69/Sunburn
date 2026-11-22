export const GOOGLE_CLIENT_ID_KEY = 'sunburn.googleClientId';

/** Public OAuth client id. A client secret is never used or stored. */
export function readGoogleClientId(): string {
  try {
    const stored = localStorage.getItem(GOOGLE_CLIENT_ID_KEY)?.trim();
    if (stored) return stored;
  } catch {
    /* private mode */
  }
  const fromEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return typeof fromEnv === 'string' ? fromEnv.trim() : '';
}

export function writeGoogleClientId(value: string): void {
  const trimmed = value.trim();
  try {
    if (trimmed) localStorage.setItem(GOOGLE_CLIENT_ID_KEY, trimmed);
    else localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
  } catch {
    /* private mode */
  }
}
