/**
 * Shared copy: optional Google document scanner + Drive backup vs on-device vault privacy.
 */

export const GOOGLE_PRIVACY_MODAL_TITLE = 'Google tools & your privacy';

/** Short notice for the Settings modal (plain text). */
export const GOOGLE_PRIVACY_MODAL_BODY = `Vault stays offline-first: your vault files live on this device unless you export or use an optional Google feature.

Document scanner (Android): Uses Google Play services on your phone to capture and straighten pages. The images are saved into your local vault like any other import—not sent to any server run by this app.

Google Drive backup (optional, Android, Pro): With an active Pro purchase you can sign in and turn on auto-upload; Vault can then copy each saved document and each backup zip to the Google account you choose; Google’s terms and controls apply there.

You can read more anytime under Settings → Privacy & Offline.`;

export const GOOGLE_PRIVACY_SECTION_TITLE = 'Optional Google services';

export const GOOGLE_PRIVACY_SCANNER = {
  title: 'Document scanner (Android)',
  body:
    'Where available, scanning uses Google’s on-device document scanner (via Google Play services). It helps you crop and capture pages. The resulting files are stored in your local vault only; this app does not upload those scans to its own servers. Google may process images according to Play services policies on your device—avoid the scanner for material you never want on Google’s stack, or use Camera / Import instead.',
} as const;

export const GOOGLE_PRIVACY_DRIVE = {
  title: 'Google Drive backup (optional, Pro)',
  body:
    'Google Drive linking and auto-upload are available on Android with an active Pro purchase. After you connect a Google account and enable auto-upload, copies of saved documents and backup zips can upload to your Google Drive under your control. That transfer is between your device and Google; it does not replace on-device storage. Review Google’s privacy policy for what happens in your Drive account.',
} as const;

export const GOOGLE_PRIVACY_CHOICE =
  'You can use Vault without either feature: keep the vault local, and only use “Open in another app” or OS sharing when you explicitly choose to.';
