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
| Biometric LockScreen (expo-local-authentication, AppState) | ✅ Done |
| PDF generation (expo-print, PdfService) + UI | ✅ Done |
| expo-notifications + store integration (expiry alerts) | ✅ Done |
| BackupService (jszip): backup/restore DB + archive | ✅ Done |

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
| OCR search: store `ocr_text`, include in search (toggle in Settings) | ✅ Done |
| Lightweight toast feedback after key actions (delete/move/duplicate/bulk) | ✅ Done |

---

## 6. Current state (summary)

- **App:** Vault – offline-first document/receipt archive (Expo SDK 54, React Native, Expo Router, TypeScript) — **Android only**.
- **Done:** Categories, documents (images/PDF/Word/Excel/Other), capture + multi-file import, import-review with file list, tags, search/sort + file-type filters, selection mode + bulk actions, duplicate, move/delete/open/save, lock (PIN/biometric), notifications, PDF export, multi-page PDF (Pro), in-app PDF viewer, backup/restore, intro pricing + paywall/quiz UX, privacy screen, toasts.
- **Notes:** OCR requires a dev build / native module to run; in Expo Go it will auto-disable and fall back to title/notes/tag search. PDF viewer is implemented as an in-app baseline viewer (Android-first).
- **Possible next:** OCR for PDFs, better PDF rendering, multi-page editing/reorder, and deeper AI-optional export UX.

---

## 7. AI Optional Workflow Upgrade (“Use AI when you want”)

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