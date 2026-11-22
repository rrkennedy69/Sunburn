import { describe, expect, it } from 'vitest';
import { PAGES_BASE, resolvePagesBase } from './pagesBase';

describe('GitHub Pages base path', () => {
  it('matches the Sunburn repository name', () => {
    expect(PAGES_BASE).toBe('/Sunburn/');
    expect(resolvePagesBase('build')).toBe('/Sunburn/');
  });

  it('keeps the dev server at the site root', () => {
    expect(resolvePagesBase('serve')).toBe('/');
  });

  it('normalizes an explicit base and still accepts a root override', () => {
    expect(resolvePagesBase('build', 'Sunburn')).toBe('/Sunburn/');
    expect(resolvePagesBase('build', '/Sunburn')).toBe('/Sunburn/');
    expect(resolvePagesBase('build', '/')).toBe('/');
  });
});
