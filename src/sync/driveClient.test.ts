import { describe, expect, it } from 'vitest';
import { planUploads } from './library';
import { DriveClient, driveError, type DriveFetch } from './driveClient';

describe('Drive client', () => {
  it('lists the app-data folder, updates an existing file, and creates a new one there', async () => {
    const calls: { url: string; method: string; body?: string; auth?: string }[] = [];
    const request: DriveFetch = async (url, init) => {
      calls.push({ url, method: init.method, body: init.body, auth: init.headers.Authorization });
      if (url.includes('spaces=appDataFolder')) {
        return {
          status: 200,
          text: JSON.stringify({
            files: [{ id: 'abc', name: 'sunburn-settings.json', modifiedTime: '2026-11-22T00:00:00Z' }],
          }),
        };
      }
      return { status: 200, text: '{"id":"new"}' };
    };

    const client = new DriveClient('token-1', request);
    const existing = await client.listSunburnFiles();
    expect(existing).toEqual([
      { id: 'abc', name: 'sunburn-settings.json', modifiedTime: '2026-11-22T00:00:00Z' },
    ]);

    const plans = planUploads(existing, [
      { name: 'sunburn-settings.json', body: '{"kind":"sunburn-settings"}' },
      { name: 'sunburn-project-box-1.json', body: '{"kind":"sunburn-project"}' },
    ]);
    for (const plan of plans) await client.upsert(plan);

    const patch = calls.find((call) => call.method === 'PATCH');
    const post = calls.find((call) => call.method === 'POST');
    expect(patch?.url).toContain('/abc');
    expect(patch?.url).toContain('uploadType=media');
    expect(patch?.auth).toBe('Bearer token-1');
    expect(post?.body).toContain('sunburn-project-box-1.json');
    expect(post?.body).toContain('appDataFolder');
    expect(calls.every((call) => call.auth === 'Bearer token-1')).toBe(true);
  });

  it('explains an origin refusal the way PrintCaddy does', () => {
    expect(driveError(403)).toMatch(/authorized JavaScript origin/);
    expect(driveError(500)).toBe('Google Drive returned HTTP 500.');
  });
});
