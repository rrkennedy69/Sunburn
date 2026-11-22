/// <reference types="vite/client" />

/** App version injected from package.json by Vite (see vite.config.ts). */
declare const __APP_VERSION__: string;

/** True only in the debug build used by the documentation screenshots. */
declare const __CAPTURE_SESSION__: boolean;

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_BASE_PATH?: string;
}
