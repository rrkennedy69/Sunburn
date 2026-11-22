/** GitHub Pages project path for https://rrkennedy69.github.io/Sunburn/ */
export const PAGES_BASE = '/Sunburn/';

/**
 * Asset base for Vite.
 * Production builds default to `/Sunburn/` so GitHub Pages resolves JS and CSS.
 * `vite` dev stays at `/`. Set `VITE_BASE_PATH` to override either one.
 */
export function resolvePagesBase(command: 'build' | 'serve', explicit?: string): string {
  const value = explicit?.trim();
  if (value) {
    if (value === '/' || value === './' || value === '.') return value === '/' ? '/' : './';
    const withSlash = value.startsWith('/') ? value : `/${value}`;
    return withSlash.endsWith('/') ? withSlash : `${withSlash}/`;
  }
  return command === 'build' ? PAGES_BASE : '/';
}
