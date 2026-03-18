# agends.md — Project context (read after context reset)

## Project identity
- **App:** Vault - Document Archive (slug: PromptBlueprint). Offline-first document, receipt, and warranty archive. No backend; data stays on device.
- **Platform:** Android only.
- **Stack:** Expo SDK 54, React Native, Expo Router (file-based), TypeScript. Dark theme; primary accent `#10a37f` (teal).

## Folder structure (concise)
- `app/` — Expo Router: `_layout.tsx` (root, lock + DB bootstrap), `(drawer)/` (drawer + index), `capture.tsx`, `document/[id].tsx`, `settings.tsx`.
- `components/` — `ui/` (PaywallModal, QuizWhyPro, InputModal, ConfirmModal, PillButton, …), `layout/CustomDrawerContent.tsx`, `document/DocumentCard.tsx`, `security/LockScreen.tsx`.
- `store/app-store.ts` — Zustand: categories, documents, isPro, pin/biometric, loadSettings, loadDocuments, addDocument, etc.
- `db/` — schema, settings, documents, categories, types. SQLite: `documents` (file_uri, purchase_price, expiry_date, notification_id), `categories` (icon_name), `settings` (key/value).
- `services/` — BackupService (jszip), NotificationService (expo-notifications), PdfService (expo-print), StorageService (archive/).
- `theme/` — Colors, Spacing, Typography, Radius.

## Current behaviour (as implemented today)
- **Pro / paywall:** Pro state is stored in the app store and in `db/settings` (e.g. `isPro`). PaywallModal offers upgrade and restore actions; limits (e.g. file count, category count) can trigger the paywall. Monetisation and IAP are not yet integrated; the UI and state are in place to support future integration.
- **AI optional workflow ("Use AI")**: Vault does not do any built-in AI processing. Users can copy a curated prompt (with placeholders like `{docTitle}`, `{docType}`, `{categoryName}`) and then share the document using an in-app AI destination picker (ChatGPT/Gemini/Claude/Copilot) with a "More…" fallback to the system share sheet. A privacy note is shown near the share step.
- **Prompt library gating:** In the Prompt Library, **each category has exactly 1 Free prompt**; all other prompts in that category are **Pro** and will open the paywall if the user tries to copy/continue.
- **EAS Update:** expo-updates is configured. `app.json` uses `runtimeVersion` (e.g. appVersion policy) and `updates.url` pointing to the EAS project. `eas.json` defines channels (e.g. preview, production) for OTA updates. JS/asset updates are published via `eas update --branch <branch>`.
- **Lock:** LockScreen reacts to AppState (e.g. background → lock). Root layout and auth flags are used to avoid lock loops and to control when biometric is requested.
- **Data:** File binaries live in the filesystem (e.g. `archive/` via StorageService); SQLite stores metadata and `file_uri`. Backup zips DB and archive; restore replaces data and reloads the store.

## Plans (reference only; see .cursor/plans/ for full detail)
- **prompt_blueprint_architecture** — Original app: Expo Router, SQLite, Zustand, drawer; later pivoted to documents.
- **secure_document_archive_pivot** — Pivot to documents: schema (file_uri, purchase_price, expiry_date), StorageService, capture/import flows.
- **premium_vault_upgrade** — Biometric lock, notifications, PDF export, backup/restore, settings table, notification_id on documents.
- **ai_workflow_upgrade** — AI-optional export workflow: prompt library (100 templates), curated AI destination picker with share fallback, and privacy disclaimer.

These plans describe the current direction and past decisions; they do not preclude other features or architectural evolution.

## Token efficiency (for the AI)
- Before a task, open or search only relevant files; avoid full-project scans when not needed.
- Use grep/codebase search to find usages; read only the files necessary for the change.
- Treat Agents.md as the single place for project identity and critical conventions; avoid relying on long chat history.
- For new features: identify the relevant store actions, services, and screens from this file first, then read the specific files involved.