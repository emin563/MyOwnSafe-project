export type MlKitErrorKind =
  | 'gps_unavailable'
  | 'canceled_via_error'
  | 'transient'
  | 'unknown';

export type MlKitScanOutcome =
  | { ok: true; pageUris: string[] }
  | {
      ok: false;
      canceled: boolean;
      errorKind?: MlKitErrorKind;
      message?: string;
    };
