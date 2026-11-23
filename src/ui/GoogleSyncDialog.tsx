import { useState } from 'react';
import { store, useAppState } from '@/state/store';
import { MATERIALS_UPDATED_EVENT, loadMaterials, saveMaterials, type MaterialEntry } from '@/core/materials';
import type { CutSettings } from '@/types/document';
import type { DeviceConfig, OptimizationSettings } from '@/gcode/types';
import type { SnapSettings } from '@/state/snapSettings';
import { Modal, useWorkspace } from './common';
import { readGoogleClientId, writeGoogleClientId } from '@/sync/clientId';
import { requestDriveToken } from '@/sync/googleAuth';
import { browserDriveFetch, DriveClient } from '@/sync/driveClient';
import { renderProjectThumbnail } from '@/state/thumbnail';
import { filesystemPath, rememberProject } from '@/state/projectLibrary';
import {
  buildSyncFiles,
  parseSyncFiles,
  planUploads,
  projectIdFromMeta,
  type SyncProject,
} from '@/sync/library';

interface Props {
  onClose: () => void;
}

/**
 * Save and open, matching PrintCaddy's Drive buttons. Saving also writes
 * machine settings, jog settings, materials, and layer presets. Opening
 * restores those and the chosen project.
 */
export function GoogleSyncDialog({ onClose }: Props) {
  const ws = useWorkspace();
  const state = useAppState();
  const [clientId, setClientId] = useState(readGoogleClientId);
  const [note, setNote] = useState(
    'Sign in with Google to keep this project, machine settings, and material and layer presets in Drive.',
  );
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<SyncProject[]>([]);

  const tokenFor = async (): Promise<string | null> => {
    const id = clientId.trim();
    if (!id) {
      setNote('Add a Google OAuth client ID first. The README explains how to create one.');
      return null;
    }
    writeGoogleClientId(id);
    setNote('Signing in to Google Drive…');
    return requestDriveToken(id);
  };

  const saveToDrive = async () => {
    setBusy(true);
    try {
      const token = await tokenFor();
      if (!token) return;
      const doc = ws?.snapshotDocument() ?? state.doc;
      const thumbnail = await renderProjectThumbnail(doc);
      await rememberProject(doc, filesystemPath(state.filePath), thumbnail);
      const files = buildSyncFiles({
        settings: {
          device: state.device,
          optimization: state.optimization,
          snap: state.snapSettings,
          jog: state.jog,
          gridSize: state.gridSize,
          showGrid: state.showGrid,
        },
        materials: loadMaterials(),
        layerPresets: store.exportLayerDefaults(),
        project: {
          id: projectIdFromMeta(doc.meta),
          name: doc.meta.name || 'Untitled',
          document: doc,
          thumbnail,
        },
      });
      const client = new DriveClient(token, browserDriveFetch);
      const existing = await client.listSunburnFiles();
      for (const plan of planUploads(existing, files)) await client.upsert(plan);
      const name = doc.meta.name || 'Untitled';
      setNote(`Saved ${name} to Google Drive. Settings and presets went with it.`);
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const applyLibrary = (parsed: ReturnType<typeof parseSyncFiles>) => {
    const settings = parsed.settings;
    if (settings?.device && typeof settings.device === 'object') {
      store.updateDevice(settings.device as Partial<DeviceConfig>);
    }
    if (settings?.optimization && typeof settings.optimization === 'object') {
      store.updateOptimization(settings.optimization as Partial<OptimizationSettings>);
    }
    if (settings?.snap && typeof settings.snap === 'object') {
      const snap = settings.snap as Partial<SnapSettings>;
      const patch: Partial<SnapSettings> = {};
      if (typeof snap.enabled === 'boolean') patch.enabled = snap.enabled;
      if (typeof snap.grid === 'boolean') patch.grid = snap.grid;
      if (typeof snap.objects === 'boolean') patch.objects = snap.objects;
      if (typeof snap.intersections === 'boolean') patch.intersections = snap.intersections;
      if (typeof snap.radiusPx === 'number') patch.radiusPx = snap.radiusPx;
      store.setSnapSettings(patch);
    }
    if (settings?.jog) store.setJogSettings(settings.jog);
    if (settings) store.setWorkspace(settings.gridSize, settings.showGrid);
    if (parsed.materials) {
      saveMaterials(parsed.materials as MaterialEntry[]);
      window.dispatchEvent(new CustomEvent(MATERIALS_UPDATED_EVENT));
    }
    if (parsed.layerPresets) {
      store.importLayerDefaults(parsed.layerPresets as Record<string, CutSettings>);
    }
  };

  const openProject = async (project: SyncProject) => {
    const ok = await ws?.openSyncedDocument(project.document);
    if (ok) setNote(`Opened ${project.name} from Google Drive.`);
  };

  const openFromDrive = async () => {
    setBusy(true);
    try {
      const token = await tokenFor();
      if (!token) return;
      const client = new DriveClient(token, browserDriveFetch);
      const listed = await client.listSunburnFiles();
      if (listed.length === 0) {
        setProjects([]);
        setNote('No SunBurn project is in this Google Drive yet.');
        return;
      }
      const downloaded = await Promise.all(
        listed.map(async (file) => ({
          name: file.name,
          body: await client.download(file.id),
          modifiedTime: file.modifiedTime ?? '',
        })),
      );
      const parsed = parseSyncFiles(downloaded);
      applyLibrary(parsed);
      const timeById = new Map<string, string>();
      for (const file of downloaded) {
        try {
          const data = JSON.parse(file.body) as { kind?: string; id?: string };
          if (data.kind === 'sunburn-project' && data.id) timeById.set(String(data.id), file.modifiedTime);
        } catch {
          /* skip a file that is not JSON */
        }
      }
      const ordered = [...parsed.projects].sort((a, b) =>
        (timeById.get(b.id) ?? '').localeCompare(timeById.get(a.id) ?? ''),
      );
      setProjects(ordered);
      const newest = ordered[0];
      if (newest) {
        const ok = await ws?.openSyncedDocument(newest.document);
        setNote(
          ok
            ? `Opened ${newest.name} from Google Drive. Settings and presets were restored.`
            : 'Settings and presets were restored. The project file could not be opened.',
        );
      } else {
        setNote('Settings and presets were restored. No project file was in Drive.');
      }
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Google Drive"
      onClose={onClose}
      width={460}
      footer={
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          Close
        </button>
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>
        {note}
      </p>
      <div className="field-row">
        <span className="field-label">Client ID</span>
        <input
          className="input"
          spellCheck={false}
          placeholder="….apps.googleusercontent.com"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          onBlur={() => writeGoogleClientId(clientId)}
        />
      </div>
      <div className="welcome-actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn primary" disabled={busy} onClick={() => void saveToDrive()}>
          Save to Drive
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => void openFromDrive()}>
          Open from Drive
        </button>
      </div>
      {projects.length > 1 && (
        <>
          <h4 style={{ margin: '14px 0 8px' }}>In this Google Drive</h4>
          <ul className="recent-list">
            {projects.map((project) => (
              <li key={project.id}>
                <button type="button" className="recent-item" onClick={() => void openProject(project)}>
                  <span className="recent-name">{project.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="hint" style={{ marginBottom: 0 }}>
        Uses the Google Identity Services token client and the hidden Drive app folder
        (drive.appdata), the same approach as PrintCaddy. The client ID is public. No client
        secret is stored in SunBurn.
      </p>
    </Modal>
  );
}
