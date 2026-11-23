import { sanitizeJogSettings, type JogSettings } from '@/serial/jog';

/** Files live in the hidden Drive app-data folder, same scope PrintCaddy uses. */
export const SETTINGS_FILE = 'sunburn-settings.json';
export const MATERIALS_FILE = 'sunburn-materials.json';
export const LAYER_PRESETS_FILE = 'sunburn-layer-presets.json';
export const PROJECT_PREFIX = 'sunburn-project-';

export interface NamedBody {
  name: string;
  body: string;
  /** Drive modifiedTime, when this body was downloaded from a listed file. */
  modifiedTime?: string;
}

export interface SyncSettings {
  device: unknown;
  optimization: unknown;
  snap: unknown;
  jog: JogSettings;
  gridSize: number;
  showGrid: boolean;
}

export interface SyncProject {
  id: string;
  name: string;
  document: unknown;
  /** SVG or PNG data URL of the artwork on the bed, when the file has one. */
  thumbnail?: string;
  /** Drive modifiedTime, or the document's own updatedAt. */
  modifiedAt?: string;
}

export interface ParsedLibrary {
  settings: SyncSettings | null;
  materials: unknown[] | null;
  layerPresets: Record<string, unknown> | null;
  projects: SyncProject[];
}

export function projectIdFromMeta(meta: { createdAt?: string }): string {
  const stamp = (meta.createdAt || '').replace(/[^0-9]/g, '').slice(0, 14);
  return stamp || 'local';
}

export function projectFileName(project: { id: string; name: string }): string {
  const slug =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'untitled';
  const id = project.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'project';
  return `${PROJECT_PREFIX}${slug}-${id}.json`;
}

export function buildSyncFiles(input: {
  settings: SyncSettings;
  materials: unknown;
  layerPresets: unknown;
  project: SyncProject | null;
}): NamedBody[] {
  const files: NamedBody[] = [
    {
      name: SETTINGS_FILE,
      body: JSON.stringify({ kind: 'sunburn-settings', version: 1, ...input.settings }),
    },
    {
      name: MATERIALS_FILE,
      body: JSON.stringify({ kind: 'sunburn-materials', version: 1, materials: input.materials }),
    },
    {
      name: LAYER_PRESETS_FILE,
      body: JSON.stringify({
        kind: 'sunburn-layer-presets',
        version: 1,
        presets: input.layerPresets,
      }),
    },
  ];
  if (input.project) {
    const body: Record<string, unknown> = {
      kind: 'sunburn-project',
      version: 1,
      id: input.project.id,
      name: input.project.name,
      document: input.project.document,
    };
    if (input.project.thumbnail) body.thumbnail = input.project.thumbnail;
    files.push({
      name: projectFileName(input.project),
      body: JSON.stringify(body),
    });
  }
  return files;
}

function documentUpdatedAt(document: unknown): string {
  if (!document || typeof document !== 'object') return '';
  const meta = (document as { meta?: { updatedAt?: unknown } }).meta;
  return typeof meta?.updatedAt === 'string' ? meta.updatedAt : '';
}

export function parseSyncFiles(files: NamedBody[]): ParsedLibrary {
  const result: ParsedLibrary = {
    settings: null,
    materials: null,
    layerPresets: null,
    projects: [],
  };
  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(file.body);
    } catch {
      continue;
    }
    if (!data || typeof data !== 'object') continue;
    const record = data as Record<string, unknown>;
    if (record.kind === 'sunburn-settings') {
      const gridSize = Number(record.gridSize);
      result.settings = {
        device: record.device ?? null,
        optimization: record.optimization ?? null,
        snap: record.snap ?? null,
        jog: sanitizeJogSettings(record.jog as Partial<JogSettings> | null),
        gridSize: Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 10,
        showGrid: record.showGrid !== false,
      };
    } else if (record.kind === 'sunburn-materials' && Array.isArray(record.materials)) {
      result.materials = record.materials;
    } else if (
      record.kind === 'sunburn-layer-presets' &&
      record.presets &&
      typeof record.presets === 'object'
    ) {
      result.layerPresets = record.presets as Record<string, unknown>;
    } else if (record.kind === 'sunburn-project' && record.document) {
      const project: SyncProject = {
        id: String(record.id ?? file.name),
        name: String(record.name ?? 'Untitled'),
        document: record.document,
      };
      if (typeof record.thumbnail === 'string' && record.thumbnail.startsWith('data:image/')) {
        project.thumbnail = record.thumbnail;
      }
      const modifiedAt = file.modifiedTime || documentUpdatedAt(record.document);
      if (modifiedAt) project.modifiedAt = modifiedAt;
      result.projects.push(project);
    }
  }
  return result;
}

export interface DriveFileRef {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface UploadPlan {
  name: string;
  body: string;
  fileId?: string;
}

/** Update a Drive file that already has this name. Create it otherwise. */
export function planUploads(existing: DriveFileRef[], files: NamedBody[]): UploadPlan[] {
  const byName = new Map(existing.map((file) => [file.name, file.id]));
  return files.map((file) => ({
    name: file.name,
    body: file.body,
    fileId: byName.get(file.name),
  }));
}
