import type { MlKitScanOutcome } from './mlKitDocumentScan.types';

export type { MlKitScanOutcome } from './mlKitDocumentScan.types';

/**
 * Non-Android: ML Kit scanner is not used.
 */
export async function launchVaultMlKitScan(_multiPageMode: boolean): Promise<MlKitScanOutcome> {
  return { ok: false, canceled: true };
}

export function isAndroidMlKitScannerPlatform(): boolean {
  return false;
}
