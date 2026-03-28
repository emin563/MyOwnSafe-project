import { requireOptionalNativeModule } from 'expo-modules-core';
import { useAppStore } from '@/store/app-store';
import { MULTI_PAGE_TESTED_LIMIT } from '@/services/performanceTargets';
import type { MlKitScanOutcome } from './mlKitDocumentScan.types';

export type { MlKitScanOutcome } from './mlKitDocumentScan.types';

const ML_SCAN_PAGE_LIMIT_SINGLE = 1;

type NativeDocumentScanner = {
  launchDocumentScannerAsync?: (options: Record<string, unknown>) => Promise<{
    canceled: boolean;
    pages: string[] | null;
    pdf: unknown;
  }>;
};

function getNativeDocumentScanner(): NativeDocumentScanner | null {
  return requireOptionalNativeModule<NativeDocumentScanner>('RNMLKitDocumentScanner');
}

/**
 * True when the ML Kit native module is present (dev build with the scanner linked).
 * Uses requireOptionalNativeModule so missing native code does not throw during render.
 */
export function isAndroidMlKitScannerPlatform(): boolean {
  const mod = getNativeDocumentScanner();
  return mod != null && typeof mod.launchDocumentScannerAsync === 'function';
}

/**
 * Opens Google Play Services ML Kit Document Scanner (edge detection, crop, filters, multi-page).
 */
export async function launchVaultMlKitScan(multiPageMode: boolean): Promise<MlKitScanOutcome> {
  const mod = getNativeDocumentScanner();
  if (!mod?.launchDocumentScannerAsync) {
    return {
      ok: false,
      canceled: true,
      message:
        'Document scanner is not in this app build. Run a native rebuild so ML Kit is linked (expo run:android / EAS).',
    };
  }

  try {
    const scannerMode = useAppStore.getState().mlKitScannerMode;
    const result = await mod.launchDocumentScannerAsync({
      pageLimit: multiPageMode ? MULTI_PAGE_TESTED_LIMIT : ML_SCAN_PAGE_LIMIT_SINGLE,
      galleryImportAllowed: true,
      resultFormats: 'jpeg',
      /** Default in store is `base`: crop-only pipeline — avoids heavy filter / “enhance” contrast and extra JPEG passes. */
      scannerMode,
    });

    if (result.canceled) {
      return { ok: false, canceled: true };
    }

    const pages = result.pages?.filter((u) => typeof u === 'string' && u.length > 0) ?? [];
    if (pages.length === 0) {
      return { ok: false, canceled: false, message: 'No scanned pages were returned.' };
    }

    return { ok: true, pageUris: pages };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Document scanner failed.';
    return { ok: false, canceled: false, message };
  }
}
