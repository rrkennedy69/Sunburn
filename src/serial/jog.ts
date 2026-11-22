/**
 * Keyboard jogging for a GRBL head.
 * Distance and speed live in settings. Arrow keys move X/Y. Page Up and Page
 * Down move Z when that axis is enabled. Typing in a field never jogs.
 */

export interface JogSettings {
  /** Step length in millimetres. */
  distanceMm: number;
  /** XY jog feed in millimetres per minute. */
  speedMmPerMin: number;
}

export const DEFAULT_JOG_SETTINGS: JogSettings = {
  distanceMm: 10,
  speedMmPerMin: 3000,
};

export const JOG_SETTINGS_KEY = 'sunburn.jog';

const MAX_DISTANCE_MM = 1000;
const MAX_SPEED = 30000;

export function sanitizeJogSettings(input: Partial<JogSettings> | null | undefined): JogSettings {
  const distance = Number(input?.distanceMm);
  const speed = Number(input?.speedMmPerMin);
  return {
    distanceMm:
      Number.isFinite(distance) && distance > 0
        ? Math.min(distance, MAX_DISTANCE_MM)
        : DEFAULT_JOG_SETTINGS.distanceMm,
    speedMmPerMin:
      Number.isFinite(speed) && speed > 0
        ? Math.min(speed, MAX_SPEED)
        : DEFAULT_JOG_SETTINGS.speedMmPerMin,
  };
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export function loadJogSettings(storage: KeyValueStore | null = defaultStorage()): JogSettings {
  try {
    const raw = storage?.getItem(JOG_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_JOG_SETTINGS };
    return sanitizeJogSettings(JSON.parse(raw) as Partial<JogSettings>);
  } catch {
    return { ...DEFAULT_JOG_SETTINGS };
  }
}

export function saveJogSettings(settings: JogSettings, storage: KeyValueStore | null = defaultStorage()): void {
  try {
    storage?.setItem(JOG_SETTINGS_KEY, JSON.stringify(sanitizeJogSettings(settings)));
  } catch {
    /* storage may be unavailable */
  }
}

function defaultStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export interface JogMove {
  axis: 'x' | 'y' | 'z';
  dx: number;
  dy: number;
  dz: number;
  feed: number;
}

export interface JogKeyModifiers {
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export function isTextEntryTarget(
  target: EventTarget | { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = el.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return !!el.isContentEditable;
}

export type JogKeyResult = { type: 'jog'; move: JogMove } | { type: 'z-disabled' } | { type: 'ignore' };

export interface JogKeyContext {
  zAxisEnabled: boolean;
  /** Feed used for Z, usually the machine's Z feed rather than the fast XY jog. */
  zSpeedMmPerMin: number;
  modifiers?: JogKeyModifiers;
  textEntry?: boolean;
  dialogOpen?: boolean;
  /** When omitted, a resolved arrow is a jog. Pass false to leave the key for nudging artwork. */
  connected?: boolean;
}

export function resolveJogKey(key: string, settings: JogSettings, options: JogKeyContext): JogKeyResult {
  if (options.textEntry || options.dialogOpen) return { type: 'ignore' };
  if (options.connected === false) return { type: 'ignore' };
  const mods = options.modifiers ?? {};
  // Alt still nudges selected artwork. Ctrl and Meta belong to shortcuts.
  if (mods.altKey || mods.ctrlKey || mods.metaKey) return { type: 'ignore' };

  const safe = sanitizeJogSettings(settings);
  const distance = Math.min(MAX_DISTANCE_MM, safe.distanceMm * (mods.shiftKey ? 10 : 1));
  const feed = safe.speedMmPerMin;
  const zFeed =
    Number.isFinite(options.zSpeedMmPerMin) && options.zSpeedMmPerMin > 0
      ? options.zSpeedMmPerMin
      : 300;

  switch (key) {
    case 'ArrowLeft':
      return { type: 'jog', move: { axis: 'x', dx: -distance, dy: 0, dz: 0, feed } };
    case 'ArrowRight':
      return { type: 'jog', move: { axis: 'x', dx: distance, dy: 0, dz: 0, feed } };
    case 'ArrowUp':
      return { type: 'jog', move: { axis: 'y', dx: 0, dy: distance, dz: 0, feed } };
    case 'ArrowDown':
      return { type: 'jog', move: { axis: 'y', dx: 0, dy: -distance, dz: 0, feed } };
    case 'PageUp':
      if (!options.zAxisEnabled) return { type: 'z-disabled' };
      return { type: 'jog', move: { axis: 'z', dx: 0, dy: 0, dz: distance, feed: zFeed } };
    case 'PageDown':
      if (!options.zAxisEnabled) return { type: 'z-disabled' };
      return { type: 'jog', move: { axis: 'z', dx: 0, dy: 0, dz: -distance, feed: zFeed } };
    default:
      return { type: 'ignore' };
  }
}
