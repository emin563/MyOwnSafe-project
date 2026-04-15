import type { BackupProgress } from '@/services/BackupService';
import { getBackupProgressDisplay } from '@/services/BackupService';

/**
 * Rough total duration (seconds) for building a vault or selection zip from disk size + file count.
 * Used only for UI smoothing and ETA — actual time varies by device and load.
 */
export function estimateBackupTotalSeconds(totalBytes: number, fileCount: number): number {
  const mb = totalBytes / (1024 * 1024);
  const base = 8;
  const perMb = 8;
  const perFile = 0.12;
  const sec = base + mb * perMb + Math.min(fileCount, 5000) * perFile;
  return Math.max(18, Math.min(900, Math.round(sec)));
}

/**
 * Smooth floor so the bar keeps moving when measured progress stalls (same window as estimate).
 * Ramps to ~92% over `estimatedMs`, then slowly approaches ~98% if work runs long.
 */
export function smoothPercentFromElapsed(elapsedMs: number, estimatedMs: number): number {
  if (estimatedMs <= 0) return 0;
  const t = elapsedMs / estimatedMs;
  if (t <= 1) return t * 92;
  const excess = elapsedMs - estimatedMs;
  const stretch = Math.min(1, excess / (estimatedMs * 0.55));
  return 92 + stretch * 6;
}

export function formatApproximateDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'a moment';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} seconds`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (s === 0) return `${m} minute${m === 1 ? '' : 's'}`;
  return `${m} min ${s} s`;
}

/**
 * ETA line for spinner-only loading UI: slightly below the model's remaining seconds so the
 * wait feels a bit ahead of the raw estimate (early / optimistic).
 */
export function formatWillBeReadyOptimisticLine(remainingSeconds: number): string {
  const optimistic = Math.max(5, Math.round(remainingSeconds * 0.88));
  return `Will be ready in approximately ${formatApproximateDurationSeconds(optimistic)}.`;
}

export function computeBlendedBackupDisplay(
  progress: BackupProgress | null,
  startedAtMs: number | null,
  estimatedTotalSeconds: number | null
): { percent: number; message: string; etaRemainingSeconds: number | null } {
  const real = progress ? getBackupProgressDisplay(progress) : { percent: 0, message: 'Please wait…' };

  if (!progress) {
    return { percent: 0, message: real.message, etaRemainingSeconds: null };
  }
  if (progress.phase === 'share') {
    return { percent: 100, message: real.message, etaRemainingSeconds: 0 };
  }

  if (
    startedAtMs == null ||
    estimatedTotalSeconds == null ||
    estimatedTotalSeconds <= 0
  ) {
    return { percent: real.percent, message: real.message, etaRemainingSeconds: null };
  }

  const elapsedMs = Date.now() - startedAtMs;
  const estimatedMs = estimatedTotalSeconds * 1000;
  const smooth = smoothPercentFromElapsed(elapsedMs, estimatedMs);
  const blended = Math.min(99, Math.max(real.percent, smooth));
  const remaining = Math.max(0, Math.ceil(estimatedTotalSeconds * (1 - blended / 100)));

  let message = real.message;
  if (progress.phase === 'compressing') {
    message = compressingStatusLine(progress);
  }

  return {
    percent: blended,
    message,
    etaRemainingSeconds: remaining,
  };
}

/** Spinner-only UI: no numeric percent in the compressing line. */
function compressingStatusLine(progress: BackupProgress & { phase: 'compressing' }): string {
  const tail =
    progress.currentFile && progress.currentFile.length > 0
      ? ` — ${progress.currentFile.split('/').pop() ?? progress.currentFile}`
      : '';
  return `Compressing backup${tail}…`;
}

/**
 * Google Drive (2nd task): rough seconds for uploading one vault file to Drive — for future UI.
 * Pair with `uploadProgress` on the blob-util fetch when adding a Drive upload overlay.
 */
export function estimateGoogleDriveDocumentUploadSeconds(fileSizeBytes: number): number {
  const mb = fileSizeBytes / (1024 * 1024);
  return Math.max(5, Math.min(180, Math.round(4 + mb * 8)));
}
