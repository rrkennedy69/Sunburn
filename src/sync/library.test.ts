import { describe, expect, it } from 'vitest';
import { DEFAULT_JOG_SETTINGS } from '@/serial/jog';
import {
  LAYER_PRESETS_FILE,
  MATERIALS_FILE,
  SETTINGS_FILE,
  buildSyncFiles,
  parseSyncFiles,
  planUploads,
  projectFileName,
} from './library';

const settings = {
  device: { baudRate: 115200, zAxisEnabled: true },
  optimization: { reduceTravel: true },
  snap: { enabled: true, grid: true },
  jog: { distanceMm: 12, speedMmPerMin: 1800 },
  gridSize: 5,
  showGrid: true,
};

describe('Google Drive library', () => {
  it('packs settings, materials, layer presets, and the current project', () => {
    const files = buildSyncFiles({
      settings,
      materials: [{ id: 'ply-3', name: 'Plywood', speed: 18, power: 55 }],
      layerPresets: { layer1: { speed: 20, power: 40 } },
      project: {
        id: '20261122',
        name: 'Maple sign',
        document: { format: 'openburn', meta: { name: 'Maple sign' } },
      },
    });
    const names = files.map((file) => file.name);
    expect(names).toContain(SETTINGS_FILE);
    expect(names).toContain(MATERIALS_FILE);
    expect(names).toContain(LAYER_PRESETS_FILE);
    expect(names).toContain(projectFileName({ id: '20261122', name: 'Maple sign' }));

    const parsed = parseSyncFiles(files);
    expect(parsed.settings?.jog).toEqual({ distanceMm: 12, speedMmPerMin: 1800 });
    expect(parsed.settings?.device).toMatchObject({ baudRate: 115200, zAxisEnabled: true });
    expect(parsed.settings?.gridSize).toBe(5);
    expect(parsed.materials).toEqual([{ id: 'ply-3', name: 'Plywood', speed: 18, power: 55 }]);
    expect(parsed.layerPresets).toEqual({ layer1: { speed: 20, power: 40 } });
    expect(parsed.projects).toEqual([
      {
        id: '20261122',
        name: 'Maple sign',
        document: { format: 'openburn', meta: { name: 'Maple sign' } },
      },
    ]);
  });

  it('repairs a missing jog block with the defaults', () => {
    const parsed = parseSyncFiles([
      {
        name: SETTINGS_FILE,
        body: JSON.stringify({ kind: 'sunburn-settings', version: 1, device: { baudRate: 9600 } }),
      },
    ]);
    expect(parsed.settings?.jog).toEqual(DEFAULT_JOG_SETTINGS);
    expect(parsed.settings?.device).toEqual({ baudRate: 9600 });
  });

  it('plans an update when Drive already has the file and a create otherwise', () => {
    const plans = planUploads(
      [{ id: 'file-1', name: SETTINGS_FILE }],
      [
        { name: SETTINGS_FILE, body: '{}' },
        { name: 'sunburn-project-box-1.json', body: '{}' },
      ],
    );
    expect(plans[0]).toMatchObject({ name: SETTINGS_FILE, fileId: 'file-1' });
    expect(plans[1]).toEqual({ name: 'sunburn-project-box-1.json', body: '{}', fileId: undefined });
  });
});
