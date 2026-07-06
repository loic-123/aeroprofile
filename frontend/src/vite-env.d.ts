/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LANDING_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
