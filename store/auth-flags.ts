export const authFlags = {
  /** Set before native pickers / share so external activity does not interfere with app state. */
  systemPickerOpen: false,
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
