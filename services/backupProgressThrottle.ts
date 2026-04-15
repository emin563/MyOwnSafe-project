import type { BackupProgress } from '@/services/BackupService';

export type BackupProgressThrottleState = { lastPhase: string; lastAt: number };

/**
 * Reduces React setState churn from fine-grained JSZip progress while still emitting
 * every phase transition (preflight → reading → compressing → saving → share).
 */
export function shouldEmitBackupProgress(
  state: BackupProgressThrottleState,
  p: BackupProgress,
  minIntervalMs: number
): boolean {
  const phaseKey = p.phase;
  const phaseChanged = phaseKey !== state.lastPhase;
  if (phaseChanged) {
    state.lastPhase = phaseKey;
    state.lastAt = Date.now();
    return true;
  }
  const now = Date.now();
  if (now - state.lastAt >= minIntervalMs) {
    state.lastAt = now;
    return true;
  }
  return false;
}

export function resetBackupProgressThrottle(state: BackupProgressThrottleState): void {
  state.lastPhase = '';
  state.lastAt = 0;
}
