import { authFlags } from '@/store/auth-flags';

/**
 * When the OS reports "background", should we start the "user minimized the app" timer?
 *
 * Plain language: we skip arming while a system sheet is up (picker, share), and for a
 * short moment after unlock because Android may emit a bogus background — not the user leaving.
 */
export function shouldArmVaultMinimizeTimer(): boolean {
  if (authFlags.systemPickerOpen) return false;
  if (authFlags.shouldIgnoreVaultMinimizeArm()) return false;
  return true;
}
