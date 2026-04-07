import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  launchDocumentScannerAsync,
  type DocumentScannerOptions,
  ResultFormatOptions,
  ScannerModeOptions,
} from '@infinitered/react-native-mlkit-document-scanner';
import { useAppStore } from '@/store/app-store';
import { MULTI_PAGE_TESTED_LIMIT } from '@/services/performanceTargets';
import { normalizeMlKitScannerMode } from '@/services/mlKitScannerMode';
import type { MlKitErrorKind, MlKitScanOutcome } from './mlKitDocumentScan.types';

export type { MlKitErrorKind, MlKitScanOutcome } from './mlKitDocumentScan.types';

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

function errorMessageFromUnknown(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Document scanner failed.';
  }
}

/**
 * Classify native / Play Services failures so the UI can show recovery actions.
 */
function classifyMlKitError(e: unknown): MlKitErrorKind {
  const msg = errorMessageFromUnknown(e);
  const lower = msg.toLowerCase();

  if (
    /result_canceled|result canceled|activity\.result_canceled|activity canceled|activity cancelled|user canceled|user cancelled|operation was canceled|cancelled by user|document scanning was canceled|scan was canceled/i.test(
      msg
    )
  ) {
    return 'canceled_via_error';
  }

  if (
    /scanner_app_unavailable|error_code_scanner_app_unavailable|scanner unavailable|gmsdocumentscanner|play services|google play services|com\.google\.android\.gms|apiexception|connectionresult|service_version_update_required|service_disabled|service_invalid/i.test(
      msg
    )
  ) {
    return 'gps_unavailable';
  }

  if (
    /timeout|timed out|temporar|try again|network|unavailable|eai_again|eagain|dead object|binder|transaction failed/i.test(
      lower
    )
  ) {
    return 'transient';
  }

  return 'unknown';
}

/**
 * Native bridge expects {@link ScannerModeOptions} enum values (Expo Enumerable), not arbitrary strings.
 */
function scannerModeFromStore(): ScannerModeOptions {
  const mode = normalizeMlKitScannerMode(useAppStore.getState().mlKitScannerMode);
  switch (mode) {
    case 'base_with_filter':
      return ScannerModeOptions.BASE_WITH_FILTER;
    case 'full':
      return ScannerModeOptions.FULL;
    default:
      return ScannerModeOptions.BASE;
  }
}

function buildScannerOptions(multiPageMode: boolean): DocumentScannerOptions {
  return {
    pageLimit: multiPageMode ? MULTI_PAGE_TESTED_LIMIT : ML_SCAN_PAGE_LIMIT_SINGLE,
    galleryImportAllowed: true,
    resultFormats: ResultFormatOptions.JPEG,
    scannerMode: scannerModeFromStore(),
  };
}

async function launchDocumentScannerOnce(multiPageMode: boolean): Promise<MlKitScanOutcome> {
  try {
    const result = await launchDocumentScannerAsync(buildScannerOptions(multiPageMode));

    if (result.canceled) {
      return { ok: false, canceled: true };
    }

    const pages = result.pages?.filter((u) => typeof u === 'string' && u.length > 0) ?? [];
    if (pages.length === 0) {
      return {
        ok: false,
        canceled: false,
        errorKind: 'unknown',
        message: 'No scanned pages were returned.',
      };
    }

    return { ok: true, pageUris: pages };
  } catch (e) {
    const kind = classifyMlKitError(e);
    if (kind === 'canceled_via_error') {
      return { ok: false, canceled: true };
    }
    const message = errorMessageFromUnknown(e);
    return { ok: false, canceled: false, errorKind: kind, message };
  }
}

/**
 * One attempt plus a single retry when the failure looks transient.
 */
async function scanWithRetry(multiPageMode: boolean): Promise<MlKitScanOutcome> {
  const first = await launchDocumentScannerOnce(multiPageMode);
  if (first.ok || first.canceled) {
    return first;
  }
  if (first.errorKind === 'transient') {
    return launchDocumentScannerOnce(multiPageMode);
  }
  return first;
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
      errorKind: 'unknown',
    };
  }

  return scanWithRetry(multiPageMode);
}
