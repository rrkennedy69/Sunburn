import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JOG_SETTINGS,
  isTextEntryTarget,
  loadJogSettings,
  resolveJogKey,
  sanitizeJogSettings,
  saveJogSettings,
  type JogSettings,
} from './jog';

const connected = {
  zAxisEnabled: true,
  zSpeedMmPerMin: 300,
  connected: true,
};

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe('jog settings', () => {
  it('keeps a positive distance and speed and rejects junk', () => {
    expect(sanitizeJogSettings({ distanceMm: 2.5, speedMmPerMin: 800 })).toEqual({
      distanceMm: 2.5,
      speedMmPerMin: 800,
    });
    expect(sanitizeJogSettings({ distanceMm: 0, speedMmPerMin: -10 })).toEqual(DEFAULT_JOG_SETTINGS);
    expect(sanitizeJogSettings({ distanceMm: 5000, speedMmPerMin: 999999 }).distanceMm).toBe(1000);
    expect(sanitizeJogSettings(null)).toEqual(DEFAULT_JOG_SETTINGS);
  });

  it('round-trips through storage and falls back when the saved value is corrupt', () => {
    const storage = memoryStore();
    const settings: JogSettings = { distanceMm: 5, speedMmPerMin: 1200 };
    saveJogSettings(settings, storage);
    expect(loadJogSettings(storage)).toEqual(settings);

    storage.setItem('sunburn.jog', '{not json');
    expect(loadJogSettings(storage)).toEqual(DEFAULT_JOG_SETTINGS);
  });
});

describe('jog key handling', () => {
  it('maps arrows to XY and pages to Z using the configured distance and speed', () => {
    const settings = { distanceMm: 4, speedMmPerMin: 1500 };
    expect(resolveJogKey('ArrowLeft', settings, connected)).toMatchObject({
      type: 'jog',
      move: { axis: 'x', dx: -4, dy: 0, dz: 0, feed: 1500 },
    });
    expect(resolveJogKey('ArrowRight', settings, connected)).toMatchObject({
      move: { dx: 4, dy: 0 },
    });
    expect(resolveJogKey('ArrowUp', settings, connected)).toMatchObject({
      move: { dx: 0, dy: 4, feed: 1500 },
    });
    expect(resolveJogKey('ArrowDown', settings, connected)).toMatchObject({
      move: { dy: -4 },
    });
    expect(resolveJogKey('PageUp', settings, connected)).toMatchObject({
      move: { axis: 'z', dz: 4, feed: 300 },
    });
    expect(resolveJogKey('PageDown', settings, connected)).toMatchObject({
      move: { dz: -4, feed: 300 },
    });
  });

  it('multiplies the distance by ten when Shift is held', () => {
    const result = resolveJogKey('ArrowUp', { distanceMm: 10, speedMmPerMin: 3000 }, {
      ...connected,
      modifiers: { shiftKey: true },
    });
    expect(result).toMatchObject({ move: { dy: 100, feed: 3000 } });
  });

  it('does not jog while typing in a text field', () => {
    const field = { tagName: 'INPUT', isContentEditable: false };
    expect(isTextEntryTarget(field)).toBe(true);
    expect(isTextEntryTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'DIV' })).toBe(false);

    const result = resolveJogKey('ArrowUp', DEFAULT_JOG_SETTINGS, {
      ...connected,
      textEntry: isTextEntryTarget(field),
    });
    expect(result).toEqual({ type: 'ignore' });
  });

  it('ignores arrows while a dialog is open, with a modifier, or when nothing is connected', () => {
    expect(resolveJogKey('ArrowRight', DEFAULT_JOG_SETTINGS, { ...connected, dialogOpen: true })).toEqual({
      type: 'ignore',
    });
    expect(
      resolveJogKey('ArrowRight', DEFAULT_JOG_SETTINGS, { ...connected, modifiers: { altKey: true } }),
    ).toEqual({ type: 'ignore' });
    expect(
      resolveJogKey('ArrowRight', DEFAULT_JOG_SETTINGS, { ...connected, modifiers: { ctrlKey: true } }),
    ).toEqual({ type: 'ignore' });
    expect(resolveJogKey('ArrowRight', DEFAULT_JOG_SETTINGS, { ...connected, connected: false })).toEqual({
      type: 'ignore',
    });
    expect(resolveJogKey('KeyS', DEFAULT_JOG_SETTINGS, connected)).toEqual({ type: 'ignore' });
  });

  it('refuses Z jogging until the Z axis is enabled', () => {
    expect(
      resolveJogKey('PageUp', DEFAULT_JOG_SETTINGS, { ...connected, zAxisEnabled: false }),
    ).toEqual({ type: 'z-disabled' });
    expect(
      resolveJogKey('PageDown', DEFAULT_JOG_SETTINGS, { ...connected, zAxisEnabled: false }),
    ).toEqual({ type: 'z-disabled' });
  });
});
