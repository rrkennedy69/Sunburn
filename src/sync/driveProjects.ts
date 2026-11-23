import { renderProjectThumbnail } from '@/state/thumbnail';
import type { StoredProject } from '@/state/projectLibrary';
import { DriveClient, browserDriveFetch, type DriveFetch } from './driveClient';
import { parseSyncFiles, type NamedBody } from './library';

export type DriveProject = StoredProject;

/**
 * Projects saved in the Drive app-data folder.
 * A thumbnail stored with the project is reused. Older files are drawn here.
 */
export async function loadDriveProjects(
  token: string,
  request: DriveFetch = browserDriveFetch,
): Promise<DriveProject[]> {
  const client = new DriveClient(token, request);
  const listed = await client.listSunburnFiles();
  const files: NamedBody[] = await Promise.all(
    listed.map(async (file) => ({
      name: file.name,
      body: await client.download(file.id),
      modifiedTime: file.modifiedTime,
    })),
  );
  const parsed = parseSyncFiles(files);
  const projects: DriveProject[] = [];
  for (const project of parsed.projects) {
    let thumbnail = project.thumbnail ?? '';
    if (!thumbnail.startsWith('data:image/')) {
      try {
        thumbnail = await renderProjectThumbnail(project.document);
      } catch {
        thumbnail = '';
      }
    }
    projects.push({
      id: `drive:${project.id}`,
      name: project.name || 'Untitled',
      modifiedAt: project.modifiedAt ?? '',
      thumbnail,
      document: project.document as DriveProject['document'],
      filePath: null,
    });
  }
  projects.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name));
  return projects;
}
