/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MSDATA_API_KEY: string;
  readonly VITE_MSDATA_LIVE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}