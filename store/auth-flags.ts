export const authFlags = {
  isAuthenticating: false,
  authEndedAt: 0,
  /** Set true before opening document/image picker so we don't lock when app goes to background. */
  systemPickerOpen: false,
  isInCooldown(): boolean {
    if (this.isAuthenticating) return true;
    return Date.now() - this.authEndedAt < 1500;
  },
};
