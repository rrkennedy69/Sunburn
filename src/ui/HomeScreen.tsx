import { useEffect, useState } from 'react';
import { readGoogleClientId, writeGoogleClientId } from '@/sync/clientId';
import { loadDriveProjects } from '@/sync/driveProjects';
import { readDriveSession } from '@/sync/driveSession';
import { requestDriveToken } from '@/sync/googleAuth';
import { listStoredProjects, type StoredProject } from '@/state/projectLibrary';
import { formatProjectDate } from './formatProjectDate';
import { SunMark } from './SunMark';

type DriveStatus = 'signed-out' | 'loading' | 'ready' | 'error';

interface Props {
  ready: boolean;
  error?: string | null;
  onNew: () => void;
  onOpenFile: () => void;
  onOpenLocal: (project: StoredProject) => void;
  onOpenDrive: (project: StoredProject) => void;
  loadLocal?: () => Promise<StoredProject[]>;
  loadDrive?: (token: string) => Promise<StoredProject[]>;
  requestToken?: (clientId: string, prompt: '' | 'none') => Promise<string>;
  readSession?: () => string | null;
  readClientId?: () => string;
  writeClientId?: (value: string) => void;
}

function ProjectCard({
  project,
  disabled,
  onOpen,
}: {
  project: StoredProject;
  disabled: boolean;
  onOpen: (project: StoredProject) => void;
}) {
  const when = formatProjectDate(project.modifiedAt);
  return (
    <button
      type="button"
      className="project-card"
      disabled={disabled}
      onClick={() => onOpen(project)}
    >
      {project.thumbnail ? (
        <img className="project-thumb" src={project.thumbnail} alt="" />
      ) : (
        <span className="project-thumb project-thumb-empty" aria-hidden="true" />
      )}
      <span className="project-meta">
        <span className="project-name">{project.name || 'Untitled'}</span>
        {when && (
          <time className="project-date" dateTime={project.modifiedAt}>
            {when}
          </time>
        )}
      </span>
    </button>
  );
}

function ProjectGrid({
  projects,
  disabled,
  onOpen,
}: {
  projects: StoredProject[];
  disabled: boolean;
  onOpen: (project: StoredProject) => void;
}) {
  return (
    <div className="project-grid">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} disabled={disabled} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** Start screen: local projects, Drive projects, and a way into the editor. */
export function HomeScreen({
  ready,
  error,
  onNew,
  onOpenFile,
  onOpenLocal,
  onOpenDrive,
  loadLocal = listStoredProjects,
  loadDrive = loadDriveProjects,
  requestToken = requestDriveToken,
  readSession = readDriveSession,
  readClientId = readGoogleClientId,
  writeClientId = writeGoogleClientId,
}: Props) {
  const [local, setLocal] = useState<StoredProject[]>([]);
  const [localNote, setLocalNote] = useState<string | null>(null);
  const [driveProjects, setDriveProjects] = useState<StoredProject[]>([]);
  const [driveStatus, setDriveStatus] = useState<DriveStatus>(() =>
    readSession() || readClientId().trim() ? 'loading' : 'signed-out',
  );
  const [driveNote, setDriveNote] = useState<string | null>(null);
  const [clientId, setClientId] = useState(readClientId);

  useEffect(() => {
    let cancelled = false;
    loadLocal()
      .then((projects) => {
        if (!cancelled) {
          setLocal(projects);
          setLocalNote(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocal([]);
          setLocalNote('Projects saved in this browser could not be read.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadLocal]);

  useEffect(() => {
    let cancelled = false;
    const show = async (token: string) => {
      setDriveStatus('loading');
      try {
        const projects = await loadDrive(token);
        if (cancelled) return;
        setDriveProjects(projects);
        setDriveStatus('ready');
        setDriveNote(null);
      } catch (err) {
        if (cancelled) return;
        setDriveProjects([]);
        setDriveStatus('error');
        setDriveNote((err as Error).message);
      }
    };

    const existing = readSession();
    if (existing) {
      void show(existing);
      return () => {
        cancelled = true;
      };
    }
    const id = readClientId().trim();
    if (!id) {
      setDriveStatus('signed-out');
      return () => {
        cancelled = true;
      };
    }
    requestToken(id, 'none')
      .then((token) => {
        if (!cancelled) return show(token);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setDriveStatus('signed-out');
      });
    return () => {
      cancelled = true;
    };
  }, [loadDrive, readClientId, readSession, requestToken]);

  const signIn = async () => {
    const id = clientId.trim();
    if (!id) {
      setDriveNote('Add a Google OAuth client ID first. The README explains how to create one.');
      setDriveStatus('signed-out');
      return;
    }
    writeClientId(id);
    setDriveStatus('loading');
    setDriveNote(null);
    try {
      const token = await requestToken(id, '');
      const projects = await loadDrive(token);
      setDriveProjects(projects);
      setDriveStatus('ready');
    } catch (err) {
      setDriveStatus('error');
      setDriveNote((err as Error).message);
    }
  };

  return (
    <div className="home-screen" data-home-screen>
      <header className="home-top">
        <div className="home-brand">
          <SunMark size={48} />
          <div>
            <h1 className="home-title">SunBurn</h1>
            <p className="home-tag">Laser cutting and engraving</p>
          </div>
        </div>
        <div className="home-actions">
          <button type="button" className="btn primary home-btn" disabled={!ready} onClick={onNew}>
            New project
          </button>
          <button type="button" className="btn home-btn" disabled={!ready} onClick={onOpenFile}>
            Open from disk
          </button>
        </div>
      </header>

      <div className="home-scroll">
        <p className="home-lead">
          Design a laser job on the bed, preview the toolpath, and send it to a GRBL machine.
          Projects you save stay in this browser. Google Drive projects show up here when you are
          signed in.
        </p>
        {error && <p className="home-error">{error}</p>}

        <section className="home-section" aria-labelledby="home-local">
          <h2 id="home-local">On this device</h2>
          {localNote && <p className="home-empty">{localNote}</p>}
          {!localNote && local.length === 0 && (
            <p className="home-empty">
              No projects on this device yet. Start a new one, or open a .obrn file. A thumbnail is
              saved each time you save.
            </p>
          )}
          {local.length > 0 && (
            <ProjectGrid projects={local} disabled={!ready} onOpen={onOpenLocal} />
          )}
        </section>

        <section className="home-section" aria-labelledby="home-drive">
          <h2 id="home-drive">Google Drive</h2>
          {driveStatus === 'loading' && <p className="home-empty">Checking Google Drive…</p>}
          {driveStatus === 'error' && driveNote && <p className="home-error">{driveNote}</p>}
          {driveStatus === 'ready' && driveProjects.length === 0 && (
            <p className="home-empty">
              No projects in Google Drive yet. Save one from File → Google Drive in the editor.
            </p>
          )}
          {driveStatus === 'ready' && driveProjects.length > 0 && (
            <ProjectGrid projects={driveProjects} disabled={!ready} onOpen={onOpenDrive} />
          )}
          {(driveStatus === 'signed-out' || driveStatus === 'error') && (
            <div className="home-drive-signin">
              {driveStatus === 'signed-out' && driveNote && <p className="home-error">{driveNote}</p>}
              <label className="home-label">
                Google client ID
                <input
                  className="input"
                  spellCheck={false}
                  placeholder="….apps.googleusercontent.com"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  onBlur={() => writeClientId(clientId)}
                />
              </label>
              <div>
                <button type="button" className="btn home-btn" onClick={() => void signIn()}>
                  Sign in to Google Drive
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
