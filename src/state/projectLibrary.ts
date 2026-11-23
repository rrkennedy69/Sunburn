import type { OpenBurnDocument } from '@/types/document';
import { renderProjectThumbnail } from './thumbnail';

/** A project remembered in this browser, with the preview saved at the last save or open. */
export interface StoredProject {
  id: string;
  name: string;
  modifiedAt: string;
  thumbnail: string;
  document: OpenBurnDocument;
  filePath: string | null;
}

export interface ProjectRepository {
  list(): Promise<StoredProject[]>;
  put(project: StoredProject): Promise<void>;
  get(id: string): Promise<StoredProject | undefined>;
}

const DB_NAME = 'sunburn';
const DB_VERSION = 1;
const STORE = 'projects';

/** Absolute filesystem paths only. A browser download name is not one. */
export function filesystemPath(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.includes('/') || path.includes('\\') || /^[a-zA-Z]:/.test(path)) return path;
  return null;
}

export function libraryProjectId(
  doc: { meta?: { createdAt?: string; name?: string } },
  filePath?: string | null,
): string {
  const path = filesystemPath(filePath);
  if (path) return `file:${path}`;
  const created = doc.meta?.createdAt?.trim();
  if (created) return `doc:${created}`;
  const name = doc.meta?.name?.trim() || 'untitled';
  return `name:${name}`;
}

export function projectDisplayName(name: string | undefined): string {
  const trimmed = (name || '').trim().replace(/\.(obrn|ovbrn)$/i, '');
  return trimmed || 'Untitled';
}

export function createMemoryProjectRepository(initial: StoredProject[] = []): ProjectRepository {
  const items = new Map(initial.map((project) => [project.id, project]));
  return {
    async list() {
      return [...items.values()];
    },
    async put(project) {
      items.set(project.id, project);
    },
    async get(id) {
      return items.get(id);
    },
  };
}

function isStoredProject(value: unknown): value is StoredProject {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<StoredProject>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.modifiedAt === 'string' &&
    typeof record.thumbnail === 'string' &&
    !!record.document &&
    (record.filePath === null || typeof record.filePath === 'string')
  );
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the project library'));
  });
}

function indexedDbRepository(db: IDBDatabase): ProjectRepository {
  return {
    list() {
      return new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        request.onsuccess = () => resolve((request.result as StoredProject[]) ?? []);
        request.onerror = () => reject(request.error ?? new Error('Could not read projects'));
      });
    },
    put(project) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(project);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Could not store the project'));
      });
    },
    get(id) {
      return new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result as StoredProject | undefined);
        request.onerror = () => reject(request.error ?? new Error('Could not read the project'));
      });
    },
  };
}

let override: ProjectRepository | null = null;
let defaultRepo: Promise<ProjectRepository> | null = null;

/** Tests inject a memory repository so they never touch IndexedDB. */
export function setProjectRepository(repo: ProjectRepository | null): void {
  override = repo;
}

async function repository(): Promise<ProjectRepository> {
  if (override) return override;
  if (!defaultRepo) {
    defaultRepo = (async () => {
      try {
        if (typeof indexedDB === 'undefined') return createMemoryProjectRepository();
        return indexedDbRepository(await openDatabase());
      } catch {
        return createMemoryProjectRepository();
      }
    })();
  }
  return defaultRepo;
}

export async function listStoredProjects(): Promise<StoredProject[]> {
  const all = await (await repository()).list();
  return all
    .filter(isStoredProject)
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name));
}

/**
 * Remember a project and the thumbnail of its artwork on the bed.
 * Pass `thumbnail` when the caller already rendered one (for example while
 * saving to Drive) so the picture is not drawn twice.
 */
export async function rememberProject(
  doc: OpenBurnDocument,
  filePath: string | null,
  thumbnail?: string,
): Promise<StoredProject | null> {
  try {
    const picture =
      thumbnail && thumbnail.startsWith('data:image/') ? thumbnail : await renderProjectThumbnail(doc);
    const record: StoredProject = {
      id: libraryProjectId(doc, filePath),
      name: projectDisplayName(doc.meta?.name),
      modifiedAt: doc.meta?.updatedAt || doc.meta?.createdAt || new Date().toISOString(),
      thumbnail: picture,
      document: doc,
      filePath: filesystemPath(filePath),
    };
    await (await repository()).put(record);
    return record;
  } catch {
    return null;
  }
}
