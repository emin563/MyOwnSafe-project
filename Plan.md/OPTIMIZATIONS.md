# Optimization Implementation Report - 2026-04-11

This file tracks what was implemented from the optimization scan and what remains.

- Scope implemented: `store/`, `db/`, `app/`, `components/`, `services/`
- Goal: apply highest-ROI fixes without changing product behavior
- Validation in this pass: project lint + IDE diagnostics

---

## Implementation Summary

Status after this implementation pass: **86 / 100**

Implemented high-impact improvements in bulk flows, store subscriptions, settings hydration, OCR quota accounting, and PDF cleanup.

---

## Implemented Fixes

### 1) Bulk operation reload batching
- Added optional `skipReload` support in store actions:
  - `addDocument(..., options?: { skipReload?: boolean })`
  - `editDocument(..., options?: { skipReload?: boolean })`
  - `removeDocument(id, options?: { skipReload?: boolean })`
- Updated bulk callsites to reload once at end:
  - `app/(drawer)/index.tsx` (bulk delete + bulk move)
  - `app/document/import-review.tsx` (add-all import)

**Files:** `store/app-store.ts`, `app/(drawer)/index.tsx`, `app/document/import-review.tsx`

### 2) Narrow Zustand subscriptions on hot screens
- Replaced broad `useAppStore()` usage with selector-based usage via `useShallow` on key surfaces.

**Files:**
- `app/(drawer)/index.tsx`
- `components/document/DocumentCard.tsx`
- `components/layout/CustomDrawerContent.tsx`
- `components/ui/PromptTemplateSheet.tsx`
- `app/_layout.tsx`
- `app/settings.tsx`
- `app/document/[id].tsx`
- `app/document/import-review.tsx`

### 3) Selection lookup optimization
- Added memoized `selectedIdSet` in home list.
- Replaced repeated `includes` checks with O(1) set membership.
- Memoized selected document derivation.

**Files:** `app/(drawer)/index.tsx`

### 4) List render stability improvements
- Memoized `renderDocument` callback.
- Stabilized `ItemSeparatorComponent` callback.
- Passed pre-resolved category info into `DocumentCard` to avoid repeated per-card lookup.

**Files:** `app/(drawer)/index.tsx`, `components/document/DocumentCard.tsx`

### 5) Settings hydration batching
- Added `getSettings(keys: string[])` with a single SQL query.
- Refactored `loadSettings()` to use batched reads instead of sequential key reads.

**Files:** `db/settings.ts`, `store/app-store.ts`

### 6) Duplicate tag copy batching
- Added `addTagsToDocument(documentId, tagIds)`.
- `duplicateDocument()` now writes copied tags in one batch insert.

**Files:** `db/tags.ts`, `store/app-store.ts`

### 7) OCR trial write consolidation
- Added `consumeOcrReadTrials(count)` for multi-trial consumption in one persisted write.
- `consumeOcrReadTrial()` now delegates to the batched method.
- Untrusted `preOcrText` path now applies quota accounting in one write.

**Files:** `store/app-store.ts`

### 8) PDF temp chunk cleanup
- `createPdfFromImages()` now cleans temporary `scan_chunk_*` files in `finally`.

**Files:** `services/PdfService.ts`

### 9) Drawer renderer stabilization
- Memoized drawer content render function.

**Files:** `app/(drawer)/_layout.tsx`

### 10) Bulk tag batching (scan §B #1)
- Added `addTagToDocuments(documentIds: number[], tagId: number)` in `db/tags.ts` — single `INSERT OR IGNORE` over all `(document_id, tag_id)` pairs.
- Store action `tagDocuments(documentIds, tagId)` wraps the DB helper.
- Home bulk tag uses one call instead of a per-row `tagDocument` loop.

**Files:** `db/tags.ts`, `store/app-store.ts`, `app/(drawer)/index.tsx`

### 11) Tag map fetch dedupe (scan §B #2)
- `visibleDocIdsSignature` — sorted, comma-joined visible document IDs (respects `fileTypeFilter`).
- Tag-loading `useEffect` depends only on `visibleDocIdsSignature` and parses IDs from the string, so sort-only or unrelated `documents` array identity changes do not refetch tags.

**Files:** `app/(drawer)/index.tsx`

### 12) Zip progress callback throttling (scan §B #4)
- `services/backupProgressThrottle.ts` — `shouldEmitBackupProgress` (phase transitions always emit; same-phase updates at most every 120 ms) and `resetBackupProgressThrottle` before each flow.
- Wired for **Settings → backup** (`createBackup`) and **home → share selection as zip** (`shareSelectedDocuments`).

**Files:** `services/backupProgressThrottle.ts`, `app/settings.tsx`, `app/(drawer)/index.tsx`

### 13) Photo library access mode session cache (scan §B #5)
- `getPhotoLibraryAccessMode()` caches the last result for ~5 s to avoid repeated native permission reads on the same capture/import session.
- `invalidatePhotoLibraryAccessModeCache()` for callers that need a fresh read after Settings changes.

**Files:** `services/photoAccessMode.ts`

---

## Remaining High-Priority Work

1. Stream backup/restore/share zip flows to reduce Base64 + JSZip memory spikes.
2. Add search pagination / incremental loading for very large vaults.
3. Further memoize OCR highlight and OCR quality derivation in `app/document/[id].tsx`.

---

## Verification

- `npm run lint`: **passes with 0 errors**.
- Existing repo-wide warnings remain in unrelated files.
- IDE diagnostics on touched files: no linter errors.

---

## Notes

- This report reflects implemented code, not only recommendations.
- Changes are optimization-focused and preserve current product behavior.

### Supplementary (2026-04 — permissions / UX, not part of the original score)

- **Android photo import alignment:** `androidPhotoPermission.ts` + `ensureMediaLibraryForImport()` in `requiredPermissions.ts` keep gallery permission state consistent with `PermissionsAndroid` / system Settings (avoids “allowed in app but denied in Settings” confusion).
- **Limited library access:** `photoAccessMode.ts` + `capture.tsx` show a short **info toast** (once per visit to the capture screen) when the library is **limited**, so users understand the **next** OS screen is normal device behavior when choosing which photos to grant — not a broken import.

---

## Optimization scan — newly added features (2026-04-11)

Scan scope: features and refactors introduced **after** the older monolithic `OPTIMIZATIONS.md` narrative (see **`Plan.md/PROGRESS.md`** §5d, §5b notes, §7 “Possible next”, and the **Implemented Fixes** sections above). Goal: identify **remaining** CPU/memory/IO hotspots, **N+1** patterns, and **rerender** risks without duplicating the “Remaining High-Priority Work” list unless there is new nuance.

### A) Feature inventory (what the scan reviewed)

| Area | Source | Code / behavior |
|------|--------|-------------------|
| Bulk reload batching | This report §1 | `skipReload` on `addDocument` / `editDocument` / `removeDocument`; single `loadDocuments` / `loadDocumentsByTag` after bulk delete/move; import-review add-all | `store/app-store.ts`, `app/(drawer)/index.tsx`, `app/document/import-review.tsx` |
| Narrow store subscriptions | This report §2 | `useShallow` selectors on hot screens | Multiple `app/*`, `components/*` |
| Home list micro-optimizations | This report §3–4 | `selectedIdSet`, memoized `renderDocument`, `categoriesById`, `DocumentCard` category prop | `app/(drawer)/index.tsx`, `components/document/DocumentCard.tsx` |
| Batched settings reads | This report §5 | `getSettings(keys[])` + `loadSettings()` | `db/settings.ts`, `store/app-store.ts` |
| Tag duplicate batch | This report §6 | `addTagsToDocument` | `db/tags.ts`, `store/app-store.ts` |
| OCR trial batching | This report §7 | `consumeOcrReadTrials` | `store/app-store.ts` |
| PDF temp cleanup | This report §8 | `scan_chunk_*` cleanup in `createPdfFromImages` | `services/PdfService.ts` |
| Drawer memo | This report §9 | Memoized drawer content | `app/(drawer)/_layout.tsx` |
| Share / backup progress UX | Not in short report body; present in tree | `BackupProgress`, `BackupProgressModal`, `estimateBackupTotalSeconds`, streaming-style zip (`streamFiles`, `STORE`, read batches) | `services/BackupService.ts`, `components/ui/BackupProgressModal.tsx`, `app/(drawer)/index.tsx`, `app/settings.tsx` |
| Android photos / limited library | **PROGRESS §5d** | `ensureMediaLibraryForImport`, `getPhotoLibraryAccessMode`, `permissions-info`, one-shot limited-library toast | `requiredPermissions.ts`, `services/photoAccessMode.ts`, `app/capture.tsx`, `app/permissions-info.tsx` |

---

### B) Findings (prioritized)

1. **~~Bulk tag still N sequential DB writes~~** — **Addressed (§10)**  
   - `addTagToDocuments` + `tagDocuments` + single bulk-tag call.

2. **~~Tag map `useEffect` refetches on any `documents` identity change~~** — **Addressed (§11)**  
   - Stable `visibleDocIdsSignature` + effect keyed only on that signature.

3. **Import-review: sequential `addDocument` loop**  
   - **Category:** I/O / concurrency  
   - **Severity:** Medium  
   - **Evidence:** `app/document/import-review.tsx` — `skipReload` avoids repeated list reloads, but each iteration still runs full `addDocument` (DB insert, possible OCR side-effects, optional Drive upload per file).  
   - **Impact:** Large multi-imports are slow; battery/network if Drive auto-upload is on.  
   - **Suggestion (larger change):** optional batch insert API + single `loadDocuments` at end; or throttle Drive uploads after batch.

4. **~~Zip progress callbacks → frequent `setState`~~** — **Addressed (§12)**  
   - 120 ms throttle with guaranteed phase transitions; `reset` at flow start.

5. **~~Photo permission + access mode checks~~** — **Addressed (§13)**  
   - ~5 s in-memory cache for `getPhotoLibraryAccessMode()`; `invalidatePhotoLibraryAccessModeCache()` for post-Settings refresh.

6. **“Remaining” list alignment**  
   - Items **1–3** in **Remaining High-Priority Work** (streaming zip, search pagination, OCR memo in editor) remain the top tier. Scan §B items **1–2, 4–5** are implemented; **3** (import-review batching) and **streaming zip** remain the largest follow-ups.

---

### C) What already looks healthy (no action required for scan)

- **Batched `getSettings`** — single `WHERE key IN (...)` replaces N sequential reads.  
- **`skipReload` bulk paths** — avoid O(n) full list reloads during bulk delete/move and import-all.  
- **`useShallow`** — reduces rerenders from unrelated store fields on key screens.  
- **Backup/share zip** — read batching, `STORE` compression, `streamFiles`, progress phases reduce perceived stall vs older all-at-once Base64 story (peak memory may still be bounded by caps + device limits).  
- **OCR trial consolidation** — fewer persisted writes for multi-page quota.

---

### D) Suggested validation (new features)

| Check | How |
|-------|-----|
| Bulk delete/move/import | Time with 50+ documents; confirm **one** list reload at end. |
| Bulk tag 30+ docs | One batched `INSERT OR IGNORE` path (`addTagToDocuments`); spot-check with large selection. |
| Tag map | Flip sort only (same IDs) — `visibleDocIdsSignature` unchanged → no extra `getTagsForDocuments` (§11). |
| Share zip | Low-end Android: scroll list while progress modal open — watch for jank; throttle if needed. |
| Limited library | **PROGRESS §5d** — first open of capture with limited access shows toast once per visit; no duplicate toasts on rotation if state is correct. |

---

### E) Relation to PROGRESS.md

- **§5d** (photos / limited access): scan confirms UX is intentional; optional **session cache** for access mode is the main perf follow-up.  
- **§5b / §7 “Possible next”** (FTS5, backup memory, adaptive OCR): partially overlapped by current **Remaining High-Priority Work**; **streaming zip** and **search pagination** remain the largest architectural wins.  
- Follow-up iteration **§10–§13** raised the Implementation Summary score from **84 → 86 / 100** by closing scan §B items **1, 2, 4, 5**; **streaming zip**, **search pagination**, import-review batching, and OCR memo work remain.
