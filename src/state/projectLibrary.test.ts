import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyDocument } from '@/types/document';
import {
  createMemoryProjectRepository,
  libraryProjectId,
  listStoredProjects,
  projectDisplayName,
  rememberProject,
  setProjectRepository,
} from './projectLibrary';

afterEach(() => {
  setProjectRepository(null);
});

function plate(name: string, createdAt: string, updatedAt: string) {
  const doc = createEmptyDocument(name);
  doc.meta.createdAt = createdAt;
  doc.meta.updatedAt = updatedAt;
  return doc;
}

describe('project library', () => {
  it('stores a thumbnail and replaces the same project', async () => {
    setProjectRepository(createMemoryProjectRepository());
    const doc = plate('Plate.obrn', '2026-06-01T00:00:00.000Z', '2026-06-15T12:00:00.000Z');

    const first = await rememberProject(doc, null, 'data:image/svg+xml,one');
    expect(first?.thumbnail).toBe('data:image/svg+xml,one');
    expect(first?.name).toBe('Plate');
    expect(first?.filePath).toBeNull();

    doc.meta.updatedAt = '2026-07-01T00:00:00.000Z';
    await rememberProject(doc, 'Plate.obrn', 'data:image/svg+xml,two');
    const listed = await listStoredProjects();
    expect(listed).toHaveLength(1);
    expect(listed[0].thumbnail).toBe('data:image/svg+xml,two');
    expect(listed[0].modifiedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('sorts newer projects first and keeps a filesystem path', async () => {
    setProjectRepository(createMemoryProjectRepository());
    const older = plate('Older', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
    const newer = plate('Newer', '2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z');
    await rememberProject(older, '/jobs/older.obrn', 'data:image/svg+xml,old');
    await rememberProject(newer, null, 'data:image/svg+xml,new');

    const listed = await listStoredProjects();
    expect(listed.map((project) => project.name)).toEqual(['Newer', 'Older']);
    expect(listed[1].filePath).toBe('/jobs/older.obrn');
    expect(listed[1].id).toBe('file:/jobs/older.obrn');
  });

  it('renders a thumbnail when the caller does not supply one', async () => {
    setProjectRepository(createMemoryProjectRepository());
    const saved = await rememberProject(plate('Box', '2026-04-01T00:00:00.000Z', '2026-04-02T00:00:00.000Z'), null);
    expect(saved?.thumbnail.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('identifies a project by its file path, otherwise by when it was created', () => {
    const doc = plate('Box', '2026-04-01T00:00:00.000Z', '2026-04-02T00:00:00.000Z');
    expect(libraryProjectId(doc, '/tmp/box.obrn')).toBe('file:/tmp/box.obrn');
    expect(libraryProjectId(doc, 'box.obrn')).toBe('doc:2026-04-01T00:00:00.000Z');
    expect(libraryProjectId(doc, null)).toBe(libraryProjectId(doc, 'box.obrn'));
    expect(projectDisplayName('  Sign.obrn ')).toBe('Sign');
    expect(projectDisplayName('')).toBe('Untitled');
  });
});
