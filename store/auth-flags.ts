export const authFlags = {
  isAuthenticating: false,
  authEndedAt: 0,
  isInCooldown(): boolean {
    if (this.isAuthenticating) return true;
    return Date.now() - this.authEndedAt < 1500;
  },
};
