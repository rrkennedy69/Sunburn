# SunBurn

Live app: https://rrkennedy69.github.io/Sunburn/

SunBurn is a free laser cutting and engraving app for a small woodwork and 3D-printing shop. It runs in the browser, drives GRBL lasers over Web Serial, and can keep projects in Google Drive.

The editor is [OpenBurn](https://github.com/SJLS27/openburn) 0.11.0 (MIT), rebranded and restyled to sit next to [PrintCaddy](https://github.com/rrkennedy69/printcaddy-rs). OpenBurn’s license is in `LICENSE`. Santiago Leal (SJLS27) wrote OpenBurn; pkkid contributed. SunBurn is not affiliated with LightBurn Software Inc.

The browser app is the one to use. An Electron shell is still in the repo.

## Home

SunBurn opens on a home screen instead of an empty editor. Projects you save are kept in this browser (IndexedDB) as a grid: a thumbnail of the artwork on the bed, the project name, and the last-modified date. From there you can open a project, start a new one, or open a `.obrn` file from disk.

If you are signed in to Google Drive, projects saved there are listed too. Signing in uses the same client ID as File → Google Drive. A thumbnail is generated whenever a project is saved, including Save to Drive.

The sun mark at the top left of the editor returns to Home. When the open project has unsaved changes, SunBurn asks you to save, discard, or cancel.

## Run it locally

Node 22 or newer.

```bash
npm ci
npm test
npm run dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317). Chrome or Edge is required for Web Serial. Firefox does not implement it.

`npm run build:web` writes a static site to `dist/` with the GitHub Pages base path `/Sunburn/`. Preview that build with:

```bash
npm run build:web
npm run preview
```

Then open [http://127.0.0.1:4318/Sunburn/](http://127.0.0.1:4318/Sunburn/).

The desktop shell, if you want it:

```bash
npm run dev:electron
```

## GitHub Pages

The workflow in `.github/workflows/pages.yml` tests, builds with `VITE_BASE_PATH=/Sunburn/`, and deploys to GitHub Pages. The site is [https://rrkennedy69.github.io/Sunburn/](https://rrkennedy69.github.io/Sunburn/).

The first publish needs one setting, because the workflow token cannot create the Pages site:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

After that, every push to `main` deploys. The same pattern is used by PrintCaddy.

## Google Drive

Sign-in uses the Google Identity Services token client, the same approach as PrintCaddy. Files go in the hidden Drive app-data folder (`drive.appdata`), not in a normal Drive folder. **Save to Drive** writes the open project plus machine settings, jog distance and speed, materials, and layer presets. **Open from Drive** restores them. File → Google Drive… opens the dialog. The buttons are “Save to Drive” and “Open from Drive”.

The OAuth client id is public. SunBurn never uses a client secret.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project.
2. Enable the **Google Drive API**.
3. Configure the OAuth consent screen (External is fine). Add the scope `https://www.googleapis.com/auth/drive.appdata`, or leave it for the app to request at sign-in.
4. Create an OAuth client id of type **Web application**.
5. Authorized JavaScript origins:
   - `http://localhost:4317`
   - `http://127.0.0.1:4317`
   - `https://rrkennedy69.github.io`
6. Copy the client id (`….apps.googleusercontent.com`).
7. Paste it into **Google Drive** in the app, or set it at build time:

```bash
VITE_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com npm run build:web
```

For Pages, add a repository **variable** named `VITE_GOOGLE_CLIENT_ID` (not a secret). The workflow passes it through. Until that variable exists, sign-in still works after you paste the id into the dialog on that browser.

If Google says the origin is not allowed, add the exact origin of the page to the client and wait a few minutes.

## Jog the head

With a machine or the GRBL simulator connected:

- Arrow keys jog X and Y.
- Page Up and Page Down jog Z when **Z axis installed** is on in Settings. Z uses the Z feed, which is slower than the XY jog.
- Distance and speed are in Settings, and the Move panel uses the same values.
- Shift multiplies the distance by ten.
- Keys do nothing while a text field, menu, or dialog has focus.
- Alt+arrows still nudge selected artwork.
- With nothing connected, arrows nudge the selection the way OpenBurn did.

Connect from the Laser panel. Web Serial asks you to pick a port. The simulator is there when no laser is plugged in.

## What this version keeps from OpenBurn

Vector drawing, layers and cut settings, image modes, animated preview, material tests, image tracing, and `.lbrn` / `.lbrn2` import and export. Project files are still `.obrn` with `format: "openburn"` so existing OpenBurn files open.

## What is still stubbed or limited

- Camera overlay in the Laser dock is a placeholder.
- File → Print and File → Exit do nothing. Close the tab to leave.
- Controllers other than GRBL (Ruida, galvo) are not implemented.
- The device name in Device Settings is not saved.
- Google sync is manual. There is no background refresh token, so each Save or Open asks Google if the session has expired.
- Web Serial needs a secure page (localhost or HTTPS) and a click. It is not available in Firefox or Safari.
- The marketing site and Flatpak packaging from OpenBurn are not part of this tree. Electron packaging scripts remain.

## Ideas left for later

[Rayforge](https://github.com/barebaric/rayforge) (MIT) is a useful reference for a later pass. Bernie is closed source; only ideas, never its code.
