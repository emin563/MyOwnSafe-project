### SECURITY AUDIT: Vault - Document Archive (Full Scan + Fixes Applied)
**Date:** 2026-04-09 (hardening pass: 2026-04-13)
**Risk Assessment:** Low-Medium
**Security Score:** 86 / 100

---

## Executive Summary

- The previously reported high findings were implemented in code during this task.
- **2026-04-13:** Share / AI egress and Google Drive uploads were tightened with shared URI rules and serialized Drive document uploads (see **M5**, **M6**).
- Current posture has no confirmed critical findings and fewer practical attack paths.
- Remaining risks are mostly policy/architecture choices (at-rest encryption and no in-app secondary lock).

---

## Implemented Fixes (This Task)

### H1 - Fixed: Office preview DoS hardening
* **Files:** `services/offlinePreview.ts`
* **Changes:**
  - Added strict max file-size checks before Base64 load for Office previews.
  - Added ZIP entry-count and total-uncompressed-size guards.
  - Added XML part-size and text-length caps before parsing.
* **Result:** Crafted oversized `.docx/.xlsx` payloads are rejected instead of fully parsed in memory.

### H2 - Fixed: Drive token storage fail-closed in production
* **Files:** `services/GoogleDriveSync.ts`
* **Changes:**
  - SQLite token fallback is now limited to dev/Expo Go scenarios.
  - Production behavior now fails closed if secure storage is unavailable.
* **Result:** Token-at-rest exposure risk is reduced on production builds.

### H3 - Fixed: Safer backup restore with staging and rollback
* **Files:** `services/BackupService.ts`
* **Changes:**
  - Added staging directory for extracted backup files.
  - Added archive swap strategy (`live -> rollback`, `stage -> live`) with rollback recovery path.
  - Added cleanup logic for stage/rollback directories.
* **Result:** Corrupt or partial restores are less likely to destroy existing archive data.

### M3 - Fixed: URI allowlist for in-app preview
* **Files:** `app/file-preview.tsx`
* **Changes:**
  - Added explicit archive-path allowlist validation for preview/open flows.
  - Blocked open-in-app action when URI is outside allowed bounds.
* **Result:** Reduced local path abuse/deep-link risk in preview route handling.

### M4 - Fixed: Removed broad legacy storage permissions
* **Files:** `app.json`
* **Changes:**
  - Removed `android.permission.READ_EXTERNAL_STORAGE`
  - Removed `android.permission.WRITE_EXTERNAL_STORAGE`
* **Result:** Smaller Android permission surface.

### Post-audit (2026-04): Scoped photo reads + limited-access behavior
* **Context:** `app.json` Android `permissions` now targets **scoped** photo access (e.g. **`READ_MEDIA_IMAGES`**) plus camera and billing. The **merged** `AndroidManifest.xml` from dependencies may still list legacy storage entries; **runtime** permission checks in **`services/androidPhotoPermission.ts`** / **`ensureMediaLibraryForImport()`** use the API-appropriate read permission so behavior matches **Settings → Permissions**.
* **Limited library access:** On Android 14+ and iOS 14+, users can grant **partial** photo access. The OS may show an **additional** picker to choose photos — this is **expected** and does **not** bypass consent; vault import only receives what the user selects. **`app/capture.tsx`** surfaces a short in-app explanation (toast) when limited access is detected to reduce confusion.

### M5 - Fixed: Share / AI workflow and PDF export — URI allowlist (defense in depth)
* **Files:** `services/archiveUri.ts` (new), `app/file-preview.tsx`, `components/ui/AiDestinationSheet.tsx`, `components/document/DocumentCard.tsx`, `app/document/[id].tsx`, `services/PdfService.ts`
* **Changes:**
  - Centralized **`isAllowedArchiveFileUri`** (vault `archive/` only) and **`isAllowedShareSourceUri`** (app document + cache paths, or OS `content://` pickers), with `..` path traversal rejected.
  - **`expo-sharing`** is only invoked when the URI passes these checks; otherwise the user sees a short toast.
  - **`exportDocumentAsPdf`** shares the generated PDF only if it remains under app sandbox paths.
* **Result:** A poisoned `file_uri` in SQLite or a bad deep link is far less likely to exfiltrate arbitrary local files through in-app share or “Share to AI”.

### M6 - Fixed: Google Drive uploads — sandbox gate, archive-only documents, serialized queue
* **Files:** `services/GoogleDriveSync.ts` (uses `services/archiveUri.ts`)
* **Changes:**
  - **`uploadLocalFileToVaultFolder`** refuses paths outside app document/cache directories.
  - **`maybeUploadVaultDocumentToGoogleDrive`** proceeds only if **`isAllowedArchiveFileUri`** (vault files), then enqueues work on a **serial** promise queue so bulk saves do not open many parallel upload sessions.
  - **Backup zip** upload requires a **`.zip`** under sandbox paths; **`uploadAllVaultDocumentsToGoogleDriveNow`** skips rows whose `file_uri` is not under the archive.
* **Result:** Drive egress is limited to expected sandbox locations; burst imports are gentler on the network stack and Google API.

---

## Current Findings (Post-Fix)

### Critical
**No confirmed critical vulnerabilities in this scan.**

### Medium
#### M1. Vault data remains unencrypted at rest
* **Location:** `db/schema.ts`, archive files
* **Status:** Open (accepted for now)
* **Risk:** Device compromise or extracted app data can expose vault content.

#### M2. No in-app secondary lock (policy choice)
* **Location:** App policy/runtime
* **Status:** Open (intentional product decision)
* **Risk:** If device is already unlocked, vault content is directly accessible.

### Low / Informational
#### L1. RevenueCat `goog_` key is public SDK key
* **Location:** `app.json`, `config/revenueCat.ts`
* **Status:** Low operational hygiene item.

#### L2. Dependencies
* **Evidence:** `npm audit --omit=dev` reports `0` vulnerabilities.
* **Status:** Healthy.

#### L3. Limited vs full photo library (informational)
* **Location:** OS permission model + `services/photoAccessMode.ts`, `app/capture.tsx`
* **Status:** Documented / UX mitigated (toast when access is **limited**).
* **Note:** Partial library grants are a **platform feature**, not a vault defect; data exposure is bounded by user selection in the system UI.

---

## Security scan: newly added features (2026-04-13)

**Sources:** `Plan.md/PROGRESS.md` (§5c Pro/quiz/dev preview, §5d Android photos + limited library, §5b / §7 optimization notes, §8 AI workflow), `Plan.md/OPTIMIZATIONS.md` (bulk `skipReload`, batched settings, tag/OCR batching, backup progress throttle, photo access cache, zip/streaming work).  
**Method:** Targeted review of the code paths those features touch (not a full repo re-audit).

### Scope (what was reviewed)

| Area | Representative files / behavior |
|------|-----------------------------------|
| Pro billing vs dev preview + quiz | `store/app-store.ts`, `services/quizWhyProStorage.ts`, `components/ui/QuizWhyPro.tsx` |
| Google Drive gating with store `isPro` | `services/GoogleDriveSync.ts` |
| Android photo permissions + limited library UX | `services/androidPhotoPermission.ts`, `services/requiredPermissions.ts`, `services/photoAccessMode.ts`, `app/capture.tsx`, `app/permissions-info.tsx` |
| Bulk ops / perf refactors | `skipReload` on `addDocument` / `editDocument` / `removeDocument`, `db/settings.ts` `getSettings`, `db/tags.ts` `addTagToDocuments`, `store/app-store.ts` `consumeOcrReadTrials` |
| Backup progress + streaming-style zip | `services/BackupService.ts`, `services/backupProgressThrottle.ts`, `components/ui/BackupProgressModal.tsx` |
| AI “Share to AI” workflow | `components/ui/UseAiWorkflowSheet.tsx`, `components/ui/AiDestinationSheet.tsx`, `components/ui/PromptTemplateSheet.tsx`, `services/AiDestinations.ts` |

### Findings

#### Critical
**None identified** in these surfaces.

#### High
**None identified** beyond controls already documented in **Implemented Fixes** (Drive token fail-closed, backup staging, preview URI allowlist, Office preview limits).

#### Medium / operational
1. **AI workflow — intentional third-party trust boundary**  
   * **Behavior:** User chooses an AI destination; the app may open a fixed deep link (`services/AiDestinations.ts`) and/or the system share sheet with `fileUri`.  
   * **Risk:** Vault content **leaves the device** to apps the user selects; this is **by design**, not a bypass of vault isolation.  
   * **Mitigation in product:** Privacy copy + optional “don’t show again” in `AiDestinationSheet`; user must confirm flow.  
   * **Code mitigations (2026-04-13):** **`isAllowedShareSourceUri`** in **`AiDestinationSheet`** (and other share entry points) blocks non-sandbox / unexpected URIs before **`Sharing.shareAsync`** (see **M5**).

2. **Quiz + marketing prefs in SQLite**  
   * **Behavior:** `quizWhyProStorage.ts` stores low-sensitivity enum-like answers under `settings`; **cleared on Pro** via `clearQuizWhyProData()`.  
   * **Risk:** Low (preferences only); same at-rest model as rest of `settings`. **No change required** for this threat model.

#### Low / informational
1. **Parameterized batch SQL** — `getSettings(keys[])` and `addTagToDocuments` use bound parameters; keys for `getSettings` are **app-controlled** literals from `loadSettings`, not user input.  
2. **`skipReload`** — Reduces list reload churn only; **does not** skip entitlement checks inside `addDocument` / limits logic.  
3. **Photo access mode cache** (`photoAccessMode.ts`, ~5s TTL) — In-memory only; at most slightly stale UX, not a confidentiality issue.  
4. **`backupProgressThrottle.ts`** — Throttles UI updates; no sensitive data.  
5. **Android photo permission alignment** (`androidPhotoPermission.ts`) — Uses API-appropriate read permission; consistent with scoped storage posture.

### What already looks sound

- **Bulk tag:** Single `INSERT OR IGNORE` with placeholders — no string-built SQL from user content.  
- **OCR trial batching:** Persists counters via existing settings path; reuses quota / trust-boundary logic for `preOcrText` in `addDocument`.  
- **Deep links for AI:** Static allowlist in code, not constructed from user input.

### Residual watchlist (not blocking)

- **Bulk import + Drive:** Large multi-imports still enqueue **one upload after another** (serialized) when auto-upload is on; each file must pass **archive + sandbox** checks (**M6**). Residual risk is intentional cloud backup of user content to Google.  
- **AI share:** **`document.file_uri`** remains the primary input; **M5** adds fail-closed checks before sharing even if a URI were inconsistent with `StorageService` expectations.

---

## Verification Notes

- `ReadLints` reported no lint errors in edited files.
- Full `npm run lint` still fails due pre-existing unrelated errors in other files (for example `app/(drawer)/index.tsx`), not from these security patches.

---

## Next Security Priorities

1. Evaluate encrypted-at-rest storage for database/files if threat model requires stronger local data protection.
2. Keep OS-level lock guidance prominent or add optional in-app lock mode for high-sensitivity users.
