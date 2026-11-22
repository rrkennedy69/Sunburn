import type { DriveFileRef, UploadPlan } from './library';

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export interface FetchResponse {
  status: number;
  text: string;
}

export type DriveFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<FetchResponse>;

export function driveError(status: number): string {
  if (status === 401 || status === 403) {
    return 'Google refused this site. Add this page’s address as an authorized JavaScript origin on the OAuth client.';
  }
  return `Google Drive returned HTTP ${status}.`;
}

export class DriveClient {
  constructor(
    private token: string,
    private request: DriveFetch,
  ) {}

  async listSunburnFiles(): Promise<DriveFileRef[]> {
    const query = encodeURIComponent("name contains 'sunburn-'");
    const url = `${DRIVE_FILES}?spaces=appDataFolder&pageSize=100&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime)&q=${query}`;
    const response = await this.request(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (response.status < 200 || response.status >= 300) throw new Error(driveError(response.status));
    const data = JSON.parse(response.text) as {
      files?: { id?: string; name?: string; modifiedTime?: string }[];
    };
    return (data.files ?? [])
      .filter((file): file is { id: string; name: string; modifiedTime?: string } =>
        typeof file.id === 'string' && typeof file.name === 'string',
      )
      .map((file) => ({ id: file.id, name: file.name, modifiedTime: file.modifiedTime }));
  }

  async download(id: string): Promise<string> {
    const url = `${DRIVE_FILES}/${encodeURIComponent(id)}?alt=media`;
    const response = await this.request(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (response.status < 200 || response.status >= 300) throw new Error(driveError(response.status));
    return response.text;
  }

  async upsert(plan: UploadPlan): Promise<void> {
    if (plan.fileId) {
      const url = `${DRIVE_UPLOAD}/${encodeURIComponent(plan.fileId)}?uploadType=media`;
      const response = await this.request(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: plan.body,
      });
      if (response.status < 200 || response.status >= 300) throw new Error(driveError(response.status));
      return;
    }

    const boundary = 'sunburn';
    const meta = JSON.stringify({ name: plan.name, parents: ['appDataFolder'] });
    const payload =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${plan.body}\r\n` +
      `--${boundary}--`;
    const url = `${DRIVE_UPLOAD}?uploadType=multipart&fields=id`;
    const response = await this.request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: payload,
    });
    if (response.status < 200 || response.status >= 300) throw new Error(driveError(response.status));
  }
}
