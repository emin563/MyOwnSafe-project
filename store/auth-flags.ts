/**
 * Vault locks only after minimize → resume. Require at least this long away so
 * short OS transitions do not count as a real minimize.
 */
export const MIN_MINIMIZED_MS_FOR_VAULT_LOCK = 2000;

/**
 * After PIN unlock, the OS may briefly report background. Do not arm the minimize
 * timer until this window has passed (clock check only — no timers).
 */
export const POST_VAULT_INTERACTION_ARM_IGNORE_MS = 1400;

export const authFlags = {
  /** Set before native pickers / share so minimize during that flow does not lock the vault. */
  systemPickerOpen: false,
  /** While Date.now() < this, do not arm vaultMinimizedAt (epoch ms). */
  ignoreVaultMinimizeArmUntil: 0,

  beginVaultPostInteractionGrace() {
    this.ignoreVaultMinimizeArmUntil = Date.now() + POST_VAULT_INTERACTION_ARM_IGNORE_MS;
  },

  shouldIgnoreVaultMinimizeArm() {
    return Date.now() < this.ignoreVaultMinimizeArmUntil;
  },
};

/** Use while native pickers / share sheets run; cleared when the awaited call settles. */
export async function withExternalActivityGuard<T>(fn: () => Promise<T>): Promise<T> {
  authFlags.systemPickerOpen = true;
  try {
    return await fn();
  } finally {
    authFlags.systemPickerOpen = false;
  }
}
