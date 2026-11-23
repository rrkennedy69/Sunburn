import { describe, expect, it } from 'vitest';
import { loadDriveProjects } from './driveProjects';
import type { DriveFetch } from './driveClient';

const saved = {
  kind: 'sunburn-project',
  version: 1,
  id: 'maple',
  name: 'Maple sign',
  thumbnail: 'data:image/svg+xml,maple',
  document: {
    format: 'openburn',
    meta: { name: 'Maple sign', updatedAt: '2026-02-01T00:00:00.000Z' },
  },
};

const bare = {
  kind: 'sunburn-project',
  version: 1,
  id: 'coaster',
  name: 'Coaster',
  document: { format: 'openburn', bed: { width: 100, height: 100 }, canvas: { objects: [] } },
};

describe('Drive projects for the home screen', () => {
  it('lists project files with their thumbnail and modified time', async () => {
    const bodies = new Map<string, string>([
      ['settings', JSON.stringify({ kind: 'sunburn-settings', version: 1 })],
      ['maple', JSON.stringify(saved)],
      ['coaster', JSON.stringify(bare)],
    ]);
    const request: DriveFetch = async (url) => {
      if (url.includes('spaces=appDataFolder')) {
        return {
          status: 200,
          text: JSON.stringify({
            files: [
              { id: 'settings', name: 'sunburn-settings.json', modifiedTime: '2026-05-01T00:00:00.000Z' },
              { id: 'maple', name: 'sunburn-project-maple.json', modifiedTime: '2026-05-02T00:00:00.000Z' },
              { id: 'coaster', name: 'sunburn-project-coaster.json', modifiedTime: '2026-06-01T00:00:00.000Z' },
            ],
          }),
        };
      }
      const id = new URL(url).pathname.split('/').pop() ?? '';
      return { status: 200, text: bodies.get(id) ?? '' };
    };

    const projects = await loadDriveProjects('token', request);
    expect(projects.map((project) => project.name)).toEqual(['Coaster', 'Maple sign']);
    expect(projects[1]).toMatchObject({
      id: 'drive:maple',
      thumbnail: 'data:image/svg+xml,maple',
      modifiedAt: '2026-05-02T00:00:00.000Z',
    });
    expect(projects[0].thumbnail.startsWith('data:image/svg+xml')).toBe(true);
    expect(projects[0].modifiedAt).toBe('2026-06-01T00:00:00.000Z');
  });
});
