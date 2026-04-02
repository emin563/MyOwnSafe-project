# Progress & Tasks

Overview of plans, tasks, and completion status. See `.cursor/plans/` for full plan docs.

---

## 1. Prompt Blueprint Architecture

**Plan:** `.cursor/plans/prompt_blueprint_architecture_b6c35345.plan.md`  
**Status:** Complete (app later pivoted to documents).

| Task | Status |
|------|--------|
| Initialize Expo (TypeScript, Expo Router, base config) | ✅ Completed |
| Configure expo-sqlite, schema/migrations (Categories, Prompts) | ✅ Completed |
| Set up Zustand store | ✅ Completed |
| Dark-mode design system and atomic UI components | ✅ Completed |
| Drawer navigation and Custom Drawer content | ✅ Completed |
| CRUD for Categories | ✅ Completed |
| CRUD for Prompts (incl. Editor) | ✅ Completed |
| expo-clipboard + expo-haptics | ✅ Completed |

---

## 2. Secure Document Archive Pivot

**Plan:** `.cursor/plans/secure_document_archive_pivot_b38d05cb.plan.md`  
**Status:** Implemented (app is now a document/receipt archive).

| Task | Status |
|------|--------|
| Install media/filesystem deps (expo-camera, expo-file-system, expo-image, etc.) | ✅ Done |
| SQLite migration: Prompts → Documents schema; update store | ✅ Done |
| StorageService (expo-file-system, archive/) | ✅ Done |
| Camera capture + file import flow | ✅ Done |
| UI: drawer, dashboard, document categories, thumbnails | ✅ Done |
| Document Editor (URI, expiry date, purchase price, etc.) | ✅ Done |

---

## 3. Premium Vault Upgrade

**Plan:** `.cursor/plans/premium_vault_upgrade_architecture_7a72a712.plan.md`  
**Status:** Implemented.

| Task | Status |
|------|--------|
| SQLite migration: `settings` table + `documents.notification_id` | ✅ Done |
| PIN LockScreen + AppState minimize/resume vault lock | ✅ Done |
| PDF generation (expo-print, PdfService) + UI | ✅ Done |
| expo-notifications + store integration (expiry alerts) | ✅ Done |
| BackupService (jszip): backup/restore DB + archive | ✅ Done |

---

## 3b. Vault lock updates (PIN-only, policy)

**Status:** Implemented.

| Task | Status |
|------|--------|
| Remove biometric unlock (`expo-local-authentication`), Settings “Biometric Lock”, and Android biometric permissions / plugin | ✅ Done |
| PIN-only `LockScreen`; vault lock gated on `pinEnabled` only (`app/_layout.tsx`, `app-store`) | ✅ Done |
| Minimize→resume lock: minimum background duration + `auth-flags` grace + `vaultLockPolicy.shouldArmVaultMinimizeTimer()` | ✅ Done |
| `withExternalActivityGuard()` on share/picker/OAuth paths (`BackupService`, `DocumentCard`, document editor, `PdfService`, `AiDestinationSheet`, `GoogleDriveOAuthPanel`, `openWithExternal`, Settings) | ✅ Done |
| `app/capture.tsx`: hold `systemPickerOpen` for whole screen mount (camera/import Add flow) | ✅ Done |
| `app/_layout.tsx`: `isAppReady` gate until after `loadSettings`; clear `systemPickerOpen` on resume before away-time check | ✅ Done |
| `LockScreen`: call `beginVaultPostInteractionGrace()` after correct PIN (aligns with store `setUnlocked` grace) | ✅ Done |
| Remove vault-lock debug / NDJSON ingest helpers (no `vaultLockDebug` / `agentDebugIngest` in tree) | ✅ Done |
| Settings: no vault Security row after biometric removal — PIN still via `pinEnabled` in DB / `setPinEnabled` only | ✅ Done (UX gap if users need in-app PIN setup) |

---

## 4. Vault File Management

**Plan:** `.cursor/plans/vault_file_management_57a5e85b.plan.md`  
**Status:** Complete.

| Task | Status |
|------|--------|
| Phase 1a: Multi-file import (image + document picker), review/assign-category screen | ✅ Done |
| Phase 1b: Delete button on document editor | ✅ Done |
| Phase 1c: “Move to category” on DocumentCard and editor | ✅ Done |
| Phase 1d: “Open in another app” and “Save to device” | ✅ Done |
| Phase 2a: Tags + document_tags tables, DB helpers, store (loadTags, addTag, tagDocument, etc.) | ✅ Done |
| Phase 2b: Tag chips in editor, tag filter in drawer, tags on DocumentCard | ✅ Done |
| Phase 2c: Search by tags; sort (Newest/Oldest/Expiring/Name) on dashboard | ✅ Done |
| Phase 3a: Long-press selection mode + toolbar | ✅ Done |
| Phase 3b–e: Bulk delete, move, zip/share, tag | ✅ Done |
| Phase 4a: Duplicate document (file copy + DB row + tags) | ✅ Done |
| Phase 4b: UX polish (haptics, empty states, Pro gating) | ✅ Done |

---

## 5. Growth / UX Enhancements (post-MVP)

**Status:** Implemented.

| Task | Status |
|------|--------|
| Drawer: add “Add file” entry under “Scan document” (opens Import tab) | ✅ Done |
| Import: support more file types (Word/Excel/TXT/CSV) | ✅ Done |
| Import screen: scrollable list (not blocked by system UI) | ✅ Done |
| Limit reached UX: show “Limit reached” options dialog before paywall | ✅ Done |
| “Why should I get Pro?” from limit dialog opens Quiz flow (not static bullets) | ✅ Done |
| Intro pricing: first 7 days ($8), then normal price ($10) | ✅ Done |
| Paywall price copy: show “$10 — one-time payment / For 7 days just $8” + tangible line | ✅ Done |
| Dashboard: quick file-type filter chips (All/Images/PDF/Word/Excel/Other) | ✅ Done |
| Settings: add “Privacy & Offline” proof screen | ✅ Done |
| In-app PDF viewer (baseline via WebView) | ✅ Done |
| Multi-page scan → single PDF flow (Pro gated) | ✅ Done |
| OCR: store `ocr_text` and always include it in vault search (no Settings toggle) | ✅ Done |
| Multi-scan OCR works for resulting PDFs (OCR on source page images before PDF creation) | ✅ Done |
| OCR UI: page-based layout + “Show more / Show less” for readability | ✅ Done |
| OCR quota/trials: duplicates reuse stored text without spending additional reads | ✅ Done |
| Lightweight toast feedback after key actions (delete/move/duplicate/bulk) | ✅ Done |

---

## 5b. Optimization & Security Hardening (implemented)

**Status:** Implemented.

| Task | Status |
|------|--------|
| Drawer search: debounce input and avoid route replacement while typing | ✅ Done |
| DB search hot-path performance: SQLite indexes + `EXISTS` tag matching | ✅ Done |
| Search CPU polish: avoid redundant JS sorting on newest results | ✅ Done |
| PromptTemplateSheet: use `FlatList` virtualization | ✅ Done |
| BackupService: zip/shares hygiene + sequential restore writes (lower memory spikes) | ✅ Done |
| BackupService: restore hardening (validate/caps sizes, sanitize archive basenames, prevent unsafe `file_uri`) | ✅ Done |
| OCR editor: cancellable `setTimeout` polling loop (no overlapping async calls) | ✅ Done |

---

## 6. Native document scan + Google Drive backup

**Status:** Implemented (Android).

| Task | Status |
|------|--------|
| ML Kit Document Scanner via `@infinitered/react-native-mlkit-document-scanner`; probe with `requireOptionalNativeModule('RNMLKitDocumentScanner')` (safe render path); fallback to expo-camera when native missing | ✅ Done |
| Capture: Android shutter uses ML Kit when linked; multi-page scan limits + free-tier slot checks preserved | ✅ Done |
| `GoogleDriveSync`: token storage (Secure Store + SQLite fallback), Vault folder create/list, zip upload to Drive, `maybeUploadVaultBackupToGoogleDrive` from `createBackup` | ✅ Done |
| Settings: `GoogleDriveBackupSection` + lazy `GoogleDriveOAuthPanel` (OAuth only when `extra.googleDriveOAuth` configured); Connect / disconnect / auto-upload toggle (`googleDriveAutoUpload`) | ✅ Done |
| Avoid `expo-auth-session` package root import in `GoogleDriveSync` (use `build/TokenRequest` + minimal token discovery) | ✅ Done |
| `app.json` `extra.googleDriveOAuth` placeholders; `expo-secure-store` plugin (not `expo-crypto` as a plugin) | ✅ Done |

---

## 6b. In-App Purchase (RevenueCat)

**Status:** Implemented (wiring complete; awaiting Google Play product creation and API key).

| Task | Status |
|------|--------|
| Install `react-native-purchases` + add `com.android.vending.BILLING` permission in `app.json` | ✅ Done |
| `config/revenueCat.ts`: API key from `app.json > extra.revenueCatApiKey`, entitlement ID `pro_access` | ✅ Done |
| `services/PurchaseService.ts`: `configureRevenueCat()`, `purchasePro()`, `restorePurchases()`, `checkProEntitlement()`, `getProPackage()` | ✅ Done |
| `app/_layout.tsx`: call `configureRevenueCat()` during bootstrap | ✅ Done |
| `store/app-store.ts`: `purchasePro()`, `restorePro()`, `syncProStatus()` actions; `loadSettings()` silently checks entitlements | ✅ Done |
| `PaywallModal`: "Unlock Pro" triggers real Google Play purchase; "Restore" always visible; loading spinner | ✅ Done |

---

## 6c. UX: App Locking info + Privacy section

**Status:** Implemented.

| Task | Status |
|------|--------|
| `app/app-locking-info.tsx`: dedicated screen with step-by-step instructions for Samsung Secure Folder, Pixel Private Space, and other Android App Lock features | ✅ Done |
| Settings Privacy section: "App Locking" row (tappable, navigates to info screen) | ✅ Done |
| Register `app-locking-info` route in `_layout.tsx` Stack | ✅ Done |

---

## 7. Current state (summary)

- **App:** Vault – offline-first document/receipt archive (Expo SDK 54, React Native, Expo Router, TypeScript) — **Android only**.
- **Done:** Categories, documents (images/PDF/Word/Excel/Other), capture + multi-file import, import-review with file list, tags, search/sort + file-type filters, selection mode + bulk actions, duplicate, move/delete/open/save, vault lock (PIN), notifications, PDF export, multi-page PDF (Pro), in-app PDF viewer, backup/restore, optional **Google Drive** copy after backup (OAuth + auto-upload toggle), **ML Kit** document scanner when native module is in the dev/production build (else camera), intro pricing + paywall/quiz UX, privacy screen, toasts, **In-App Purchase** (RevenueCat + Google Play Billing), **App Locking** info guide.
- **Notes:** OCR (`expo-text-extractor` / dev build) may be unavailable in Expo Go; search still uses title/notes/tags and stored `ocr_text` when present. ML Kit requires a **native rebuild** with the Infinitered module linked; otherwise capture uses expo-camera only. Google Drive Connect requires valid OAuth client IDs in `app.json` extra and a build that includes **expo-crypto** (dependency of `expo-auth-session`; autolinks — do not declare as a config plugin).
- **Notes (IAP):** RevenueCat SDK (`react-native-purchases`) integrated; `PaywallModal` triggers real purchases. Requires: (1) `revenueCatApiKey` in `app.json` extra, (2) Google Play product created, (3) native rebuild for billing permission.
- **Notes (reliability/perf):** Drawer search is debounced, hot-path DB indexes + `EXISTS` reduce expensive search work, backup restore is hardened/sanitized, OCR polling uses a cancellable `setTimeout` loop, and multi-scan OCR enforces the quota trust boundary via internal pending OCR drafts.
- **Notes (vault lock):** PIN-only; AppState minimize→resume with thresholds and `auth-flags` / `vaultLockPolicy`; capture screen and guarded shares/pickers avoid false locks. See §3b and `Plan.md/AGENTS.md`.
- **Possible next:** OCR for user-imported PDFs, FTS5-based search acceleration, stricter backup/PDF memory limits, adaptive OCR polling/backoff, better PDF rendering, deeper AI-optional export UX, iOS parity (not a current target).

---

## 8. AI Optional Workflow Upgrade (“Use AI when you want”)

**Plan:** `.cursor/plans/ai_workflow_upgrade_798680b0.plan.md`  
**Status:** Implemented.

| Task | Status |
|------|--------|
| Add curated AI destinations picker (ChatGPT/Gemini/Claude/Copilot + “More…” fallback) | ✅ Done |
| Add privacy disclaimer near share step (optional “don’t show again”) | ✅ Done |
| Add prompt library UI (search + category chips + prompt cards) | ✅ Done |
| Add 100 curated prompt templates with placeholders | ✅ Done |
| Wire “Use AI” entry points (DocumentCard + document editor) | ✅ Done |
| **Gating: 1 Free prompt per category, others Pro** | ✅ Done |