### 1) Optimization Summary

Optimization health is **good for a local-first Expo app**, with meaningful wins already implemented (debounced search, indexed DB paths, safer/less spiky restore, virtualized prompt list, non-overlapping OCR polling). The main remaining performance ceiling is **SQLite substring search** (`%LIKE%`) and **memory-heavy Base64 pipelines** (backup/PDF) as vault size grows.

Top 3 highest-impact improvements (next):
1. **Introduce SQLite FTS5** for document text search (title/notes/ocr_text) to avoid `%LIKE%` scaling cliffs.
2. **Reduce Base64 memory pressure** in backup/PDF flows (caps already exist on restore; creation/export still can spike).
3. **Move sorting work closer to SQL** (or precompute timestamps) to avoid repeated `Date` parsing during JS sorts.

Biggest risk if no changes are made:
- With thousands of documents and substantial OCR text, **search can become slow** (full scans) and **backup/PDF operations can hit memory limits** on mid-range Android devices.

Current implemented optimization/security posture (high signal):
- **Debounced drawer search** and no per-keystroke route replacement: `components/layout/CustomDrawerContent.tsx`.
- **DB search rewrite + LIMIT + indexes**: `db/documents.ts` (`EXISTS` + `LIMIT`) and `db/schema.ts` (indexes).
- **Prompt library virtualization**: `components/ui/PromptTemplateSheet.tsx` uses `FlatList`.
- **Backup/restore hardening + sequential restore writes + cache cleanup**: `services/BackupService.ts`.
- **OCR polling is cancellable + adaptive backoff**: `app/document/[id].tsx`.
- **Tag fetch respects file-type filter**: `app/(drawer)/index.tsx`.
- **Security hardening details**: `Plan.md/SECURITY.md`.

---

### 2) Findings (Prioritized)

#### **FTS5 needed to avoid `%LIKE%` scaling cliffs**
- **Title**: DB search still relies on `%LIKE%` across large text fields
- **Category**: DB
- **Severity**: High
- **Impact**: latency, battery, scalability (large vaults), perceived responsiveness
- **Evidence**: `db/documents.ts` `searchDocuments()` uses `LIKE '%query%'` on `title/notes` and optionally `ocr_text` plus tag match via `EXISTS`, with `ORDER BY updated_at DESC` and `LIMIT`.
- **Why it’s inefficient**: `%term%` forces scans; indexes help joins/order but not substring matches.
- **Recommended fix**:
  - Add FTS5 virtual table for `documents(id, title, notes, ocr_text)` and query via `MATCH`.
  - Keep FTS in sync via triggers or explicit updates in create/update paths.
  - Keep tag search as `EXISTS` or denormalize tag names into an auxiliary FTS table keyed by document id.
- **Tradeoffs / Risks**: Complexity + migration risk; must ensure consistency on restore/duplicate/bulk operations.
- **Expected impact estimate**: High (orders-of-magnitude faster search on large datasets).
- **Removal Safety**: Needs Verification
- **Reuse Scope**: service-wide (search everywhere)

#### **Backup/PDF creation still memory-heavy due to Base64 + JSZip / HTML embedding**
- **Title**: Base64-heavy creation paths can still cause memory spikes
- **Category**: Memory
- **Severity**: High
- **Impact**: stability, latency, OOM risk on large archives/images
- **Evidence**:
  - `services/BackupService.ts` backup creation reads each archive file as Base64 and builds JSZip in memory before writing a Base64 zip.
  - `services/PdfService.ts` embeds full Base64 image data into HTML for print.
- **Why it’s inefficient**: Base64 inflates payload; JSZip holds data in memory; HTML embedding duplicates memory.
- **Recommended fix**:
  - Add **backup creation caps** similar to restore caps (total files/bytes).
  - Consider chunked/streamed approaches where Expo allows (or enforce practical limits with clear UX).
  - Prefer smaller thumbnails or reduced quality for PDF embeds, or embed via file references if supported.
- **Tradeoffs / Risks**: Limits affect power users; streaming may not be feasible in Expo without native work.
- **Expected impact estimate**: Medium-High (stability and predictable performance).
- **Removal Safety**: Needs Verification
- **Reuse Scope**: service-wide (backup/PDF)

#### **Sorting still does repeated Date parsing in JS**
- **Title**: `sortDocumentsBy()` repeatedly constructs `Date` objects
- **Category**: CPU
- **Severity**: Medium
- **Impact**: UI jank on large lists, battery
- **Evidence**: `store/app-store.ts` comparator uses `new Date(updated_at).getTime()` repeatedly.
- **Why it’s inefficient**: \(O(n\log n)\) sorts * comparator allocations add up.
- **Recommended fix**:
  - Precompute `updatedAtMs` once per doc list (derive from ISO string) and sort on number.
  - Or implement ordering in SQL for each sort mode (newest/oldest/expiring/name) to avoid JS sort.
- **Tradeoffs / Risks**: SQL sort requires dynamic queries; ensure consistent behavior with tag/category filters.
- **Expected impact estimate**: Medium
- **Removal Safety**: Likely Safe
- **Reuse Scope**: store-wide

#### **Search debounce is correct, but ensure result-limit UX expectations**
- **Title**: Search now limits results; UX may need pagination/“show more”
- **Category**: Frontend
- **Severity**: Medium
- **Impact**: responsiveness (positive) vs completeness (user expectations)
- **Evidence**: `db/documents.ts` `searchDocuments(..., limit=200)` clamps to max 500.
- **Why it’s inefficient**: Not inefficient—this is a performance safety valve; but it changes semantics.
- **Recommended fix**:
  - Add “show more results” UX or pagination when result count hits the cap.
  - Optionally show a small hint: “Showing first 200 results”.
- **Tradeoffs / Risks**: Extra UI/logic; requires count query for full transparency.
- **Expected impact estimate**: Medium (UX + predictable performance)
- **Removal Safety**: Safe
- **Reuse Scope**: module/UI-wide

#### **OCR extraction/quotas are safer but still can be slow on large multi-scan**
- **Title**: Multi-page OCR is CPU-heavy; needs guardrails and progress UX
- **Category**: CPU
- **Severity**: Medium
- **Impact**: latency, battery, perceived hangs
- **Evidence**: `app/capture.tsx` performs sequential OCR on multi-page images before PDF creation; `app/document/[id].tsx` uses adaptive polling.
- **Why it’s inefficient**: OCR is expensive; sequential is stable but slow; long operations need strong UX.
- **Recommended fix**:
  - Keep sequential OCR, but ensure a **clear progress indicator** and enforce safe page caps (already warnings exist; ensure caps apply consistently across flows).
  - Consider “OCR later” option (save PDF immediately, run OCR in background when idle).
- **Tradeoffs / Risks**: Background OCR may be constrained by Expo lifecycle; must not corrupt quota accounting.
- **Expected impact estimate**: Medium
- **Removal Safety**: Needs Verification
- **Reuse Scope**: capture/editor flows

---

### 3) Quick Wins (Do First)

- **FTS5 spike prototype**: add FTS table + query path behind a feature flag; measure search p95 on 1k/5k docs.
- **Backup creation size cap**: prevent creating zips above a configured size (with a clear error/toast).
- **Precompute timestamps for sorts**: small refactor with measurable list-scroll improvement.
- **Result cap UX**: show “first N results” indicator when capped.

---

### 4) Deeper Optimizations (Do Next)

- **Full-text search architecture**:
  - FTS5 for `title/notes/ocr_text`, with triggers for sync.
  - Optional: tag name denormalization for unified search ranking.
- **Binary-safe zip pipeline**:
  - Explore alternatives to Base64 zips (native module or different packaging format) if “large vault backup” is a core use case.
- **Move sorting/filtering into SQL**:
  - Reduce JS work and memory churn on large lists.
- **Background OCR pipeline**:
  - Opportunistic OCR when plugged in / idle; UI shows “OCR pending”.

---

### 5) Validation Plan

Benchmarks:
- **Search**:
  - Dataset: 100 / 1k / 5k documents, with tags and realistic OCR text sizes.
  - Measure: query p50/p95 duration + time from last keystroke to list update.
  - Compare: `%LIKE%` vs FTS5.
- **List performance**:
  - Measure: scroll FPS and JS thread time on dashboard with 1k docs; compare JS sort vs SQL sort / precomputed ms.
- **Backup/PDF**:
  - Measure: peak memory and completion time for backup creation and PDF export at increasing sizes.

Profiling strategy:
- Android Studio Profiler (CPU + memory) during search typing, backup creation, restore, PDF export, multi-page OCR.
- Add lightweight in-app timing hooks (you already have `recordPerformanceMetric` in PDF view codepaths).

Metrics:
- Search p95 (ms), DB calls per typing session, time-to-results (ms)
- Peak memory (MB) for backup/PDF
- Restore completion rate and time (with large archive entries)

Correctness tests:
- Search still matches: title, notes, tags, OCR.
- Sorting modes are consistent across category/tag/search.
- Backup restore round-trip preserves metadata and doesn’t write outside archive.
- OCR quota enforcement holds (no bypass via injected preOcrText).

---

### 6) Optimized Code / Patch (when possible)

Below are focused patch directions (not applied here). Most quick-win changes are small and localized:

1. **FTS5**: add `documents_fts` virtual table + triggers; update `searchDocuments()` to use `MATCH` and fall back to `%LIKE%` for older DBs during migration.
2. **Backup create cap**: compute archive size/file count before Base64 reads and abort early with a user-facing message.
3. **Sorting**: map documents to include `updatedAtMs` once and sort numbers; or move sorts into SQL query variants.

