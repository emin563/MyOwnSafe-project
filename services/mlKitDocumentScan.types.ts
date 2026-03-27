export type MlKitScanOutcome =
  | { ok: true; pageUris: string[] }
  | { ok: false; canceled: boolean; message?: string };
