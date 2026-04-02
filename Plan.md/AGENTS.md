# AGENTS.md — Project context (read after context reset)

## Project identity
- **App:** Vault - Document Archive (slug: PromptBlueprint). Offline-first document, receipt, and warranty archive. No backend; data stays on device.
- **Platform:** Android only.
- **Stack:** Expo SDK 54, React Native, Expo Router (file-based), TypeScript. Dark theme; primary accent `#10a37f` (teal).

## Folder structure (concise)
- `app/` — Expo Router: `_layout.tsx` (root, lock + DB + RevenueCat bootstrap), `(drawer)/` (drawer + index), `capture.tsx`, `document/[id].tsx`, `settings.tsx`, `app-locking-info.tsx` (step-by-step guide for Android system app locks).
- `components/` — `ui/` (PaywallModal, QuizWhyPro, InputModal, ConfirmModal, PillButton, …), `layout/CustomDrawerContent.tsx`, `document/DocumentCard.tsx`, `security/LockScreen.tsx`, `settings/` (`GoogleDriveBackupSection`, `GoogleDriveOAuthPanel`, `googleDriveBackup.styles`).
- `config/` — `googleDrive.ts` reads `expo.extra.googleDriveOAuth` (Android/Web OAuth client IDs for Drive). `revenueCat.ts` reads `expo.extra.revenueCatApiKey` and exports the entitlement ID (`pro_access`).
- `store/app-store.ts` — Zustand: categories, documents, isPro, PIN lock (`pinEnabled`, `pinHash`, `isUnlocked`), `purchasePro`, `restorePro`, `syncProStatus`, loadSettings, loadDocuments, addDocument, etc.
- `store/auth-flags.ts` — Vault minimize timer: `MIN_MINIMIZED_MS_FOR_VAULT_LOCK`, post-unlock grace (`beginVaultPostInteractionGrace`), `systemPickerOpen`, `withExternalActivityGuard()` for pickers/share.
- `services/vaultLockPolicy.ts` — `shouldArmVaultMinimizeTimer()` (gates when AppState “background” starts the away timer).
- `db/` — schema, settings, documents, categories, types. SQLite: `documents` (file_uri, purchase_price, expiry_date, notification_id), `categories` (icon_name), `settings` (key/value).
- `services/` — BackupService (jszip + optional Drive upload hook), GoogleDriveSync (OAuth tokens, Drive folder, upload), `mlKitDocumentScan(.android).ts` + `mlKitDocumentScan.types.ts`, NotificationService, PdfService, `PurchaseService.ts` (RevenueCat wrapper), StorageService, `ocrExtract.ts`, etc.
- `theme/` — Colors, Spacing, Typography, Radius.

## Current behaviour (as implemented today)
- **Pro / paywall / In-App Purchase:** Pro state is stored in the app store and in `db/settings` (`isPro`). **RevenueCat** (`react-native-purchases`) is integrated: `PurchaseService.ts` wraps configure, purchase, restore, and entitlement checks. `PaywallModal` triggers a real Google Play purchase sheet via `purchasePro()` and always shows a "Restore" button via `restorePro()`. On app launch, `loadSettings()` silently checks RevenueCat entitlements in the background and syncs local Pro state. API key is read from `app.json > extra.revenueCatApiKey`; entitlement ID is `pro_access`. `com.android.vending.BILLING` permission is declared in `app.json`. A native rebuild is required after adding the SDK.
- **AI optional workflow ("Use AI")**: Vault does not do any built-in AI processing. Users can copy a curated prompt (with placeholders like `{docTitle}`, `{docType}`, `{categoryName}`) and then share the document using an in-app AI destination picker (ChatGPT/Gemini/Claude/Copilot) with a "More…" fallback to the system share sheet. A privacy note is shown near the share step.
- **Prompt library gating:** In the Prompt Library, **each category has exactly 1 Free prompt**; all other prompts in that category are **Pro** and will open the paywall if the user tries to copy/continue.
- **OCR (text extraction):** “Text from photo” is opt-in (Add → Camera / Import). Extracted OCR text is stored on the document and indexed for search.
- **OCR settings simplified:** The Settings “search inside images” toggle has been removed; vault search always includes stored `ocr_text` when present.
- **Multi-scan stability (PDF output):** In Pro multi-page scan, OCR runs on the original page images before the PDF is created; the resulting PDF document gets combined page-wise `ocr_text`, so copy/display works reliably.
- **OCR UI organization:** OCR text is shown in page cards with “Show more / Show less” for readability (images and multi-scan PDFs).
- **Free trial/quota behavior:** On Free, multi-scan OCR consumes read trials only when recognized text is produced; duplicating documents reuses stored OCR text without spending additional reads.
- **Performance / search:** Drawer search is debounced (avoids per-keystroke expensive work and route replacement). DB search is supported by hot-path SQLite indexes and uses `EXISTS`-based tag matching to reduce join/row explosion; “newest” results avoid redundant JS sorting.
- **Backup / restore reliability + security:** Backup restore treats the backup as untrusted input: validates/caps sizes/counts, sanitizes archive entry basenames, derives restored `documents.file_uri` only from safe archive basenames, and writes archive entries sequentially to reduce memory spikes.
- **Google Drive backup (Android):** After a local `VaultBackup.zip` is written, `BackupService.createBackup()` calls `maybeUploadVaultBackupToGoogleDrive` (silent; failures do not block the share sheet). OAuth uses `expo-auth-session` only inside a **lazy-loaded** `GoogleDriveOAuthPanel` (avoids pulling `expo-auth-session` index → PKCE → `expo-crypto` on every Settings load). `GoogleDriveSync` stores tokens in **expo-secure-store** when the native module exists, else falls back to SQLite `settings` keys (`googleDriveTokenV1`, `googleDriveFolderIdV1`). `TokenResponse` is imported from `expo-auth-session/build/TokenRequest` (not the package root) so `BackupService` → `GoogleDriveSync` does not load PKCE at import time. Configure `app.json` → `extra.googleDriveOAuth` (`androidClientId`, `webClientId`); enable Drive API + OAuth in Google Cloud. **Do not** add `expo-crypto` under `expo.plugins` — it has no config plugin; it autolinks with a native rebuild (`expo run:android` / EAS).
- **Native document scan (Android):** `@infinitered/react-native-mlkit-document-scanner` provides ML Kit Document Scanner when the native module is linked. **Do not** `require()` the package entry during render — it calls `requireNativeModule` and throws if missing. Use `requireOptionalNativeModule('RNMLKitDocumentScanner')` from `expo-modules-core` in `mlKitDocumentScan.android.ts`: if present, the capture shutter opens the ML Kit UI (multi-page up to 100 pages, JPEG); if absent (e.g. stale dev client), `isAndroidMlKitScannerPlatform()` is false and **expo-camera** is used. Rebuild the native app after adding the dependency.
- **OCR polling & quota trust boundary:** OCR editor polls using a cancellable `setTimeout` loop (no overlapping async DB calls). Multi-scan passes pre-extracted OCR (`preOcrText`) and it is accepted as “trusted” only when it matches the internal `pendingOcrText` draft for the exact `fileUri`/`fileType`, enforcing Free-tier quota boundaries.
- **EAS Update:** expo-updates is configured. `app.json` uses `runtimeVersion` (e.g. appVersion policy) and `updates.url` pointing to the EAS project. `eas.json` defines channels (e.g. preview, production) for OTA updates. JS/asset updates are published via `eas update --branch <branch>`.
- **Lock:** PIN-only `LockScreen` (`components/security/LockScreen.tsx`). No `expo-local-authentication` / biometric unlock. Root `app/_layout.tsx` listens to AppState: vault re-locks only after the app was in the background long enough (`MIN_MINIMIZED_MS_FOR_VAULT_LOCK` in `auth-flags.ts`). `shouldArmVaultMinimizeTimer()` skips arming while `systemPickerOpen` is true or during the post-unlock grace window (`POST_VAULT_INTERACTION_ARM_IGNORE_MS`; `beginVaultPostInteractionGrace()` runs on successful PIN entry and when the store unlocks). On resume from background, `_layout` clears `systemPickerOpen` before evaluating away-time. **Bootstrap:** AppState lock logic is skipped until `isAppReady` flips after `loadSettings()` in `_layout` so early background transitions do not confuse lock state. **`capture` screen:** While `app/capture.tsx` is mounted it sets `authFlags.systemPickerOpen = true` so camera/picker transitions on the Add flow do not arm the minimize timer. **`withExternalActivityGuard`:** Wraps native share/picker/OAuth flows in `BackupService`, `DocumentCard`, `app/document/[id].tsx` (share), `PdfService`, `AiDestinationSheet`, `GoogleDriveOAuthPanel`, `services/openWithExternal.ts`, and Settings regression share — sets `systemPickerOpen` for the duration of the async call. **Settings:** The old Settings **Security** row (biometric toggle) was removed with biometrics; vault lock is still controlled only by `pinEnabled` / `pinHash` in SQLite via `setPinEnabled` in the store (no dedicated Settings PIN UI at present). **Debug:** Prior vault-lock NDJSON/debug helper modules were removed; do not reintroduce ad-hoc log ingest without an explicit product decision.
- **Data:** File binaries live in the filesystem (e.g. `archive/` via StorageService); SQLite stores metadata and `file_uri`. Backup zips DB and archive; restore replaces data and reloads the store.
- **Settings keys (Drive):** `googleDriveAutoUpload` (`'1'` / `'0'`) toggles silent upload after each backup build.

## Plans (reference only; see .cursor/plans/ for full detail)
- **prompt_blueprint_architecture** — Original app: Expo Router, SQLite, Zustand, drawer; later pivoted to documents.
- **secure_document_archive_pivot** — Pivot to documents: schema (file_uri, purchase_price, expiry_date), StorageService, capture/import flows.
- **premium_vault_upgrade** — Vault lock (PIN), notifications, PDF export, backup/restore, settings table, notification_id on documents.
- **ai_workflow_upgrade** — AI-optional export workflow: prompt library (100 templates), curated AI destination picker with share fallback, and privacy disclaimer.

These plans describe the current direction and past decisions; they do not preclude other features or architectural evolution.

## Troubleshooting (vault lock vs plans vs IDE)

### Is the “wrong-time lock” the same as the problems in `Plan.md/security.md` or `OPTIMIZATIONS.md`?
**No.** Those docs focus on **backup/restore safety**, **search/DB performance**, **OCR polling**, and related items. They do **not** describe **AppState-driven vault lock** edge cases (e.g. system UI briefly looking like background).

### `node_modules/expo-web-browser/tsconfig.json` — “expo-module-scripts/tsconfig.base not found”
**Unrelated to the vault lock.** That package’s `tsconfig` extends a dev-only path used inside the Expo repo. Your app’s root `tsconfig.json` already **excludes `node_modules`**; the warning usually appears only if you **open** a file under `node_modules` in the editor. It does **not** break `expo start` or the running app. Safe to ignore, or avoid opening that file.

### Ruling out a stale JavaScript bundle (so code changes actually apply)
1. Stop Metro, then start with a clean cache: `npx expo start --clear` (or `expo start -c`).
2. Reload the app (dev menu → Reload). If you use a **dev client**, rebuild after native changes: `expo run:android`.
3. If you use **EAS Update**, confirm the device is on the branch/channel you published; OTA can serve older JS until a new update is installed.

## Token efficiency (for the AI)
- Before a task, open or search only relevant files; avoid full-project scans when not needed.
- Use grep/codebase search to find usages; read only the files necessary for the change.
- Treat Agents.md as the single place for project identity and critical conventions; avoid relying on long chat history.
- For new features: identify the relevant store actions, services, and screens from this file first, then read the specific files involved.