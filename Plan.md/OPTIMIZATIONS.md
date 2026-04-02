### 1) Optimization Summary

Overall, the app is well-structured for an offline-first, local-SQLite workflow. After two optimization passes the critical hotspots have been addressed and the remaining work is polish and monitoring.

Top 3 remaining improvements (future):
1. Stream-based backup/restore to reduce peak Base64 memory (requires native module or Expo FileSystem streaming API).
2. Add search-result pagination (infinite scroll) instead of a hard 200-row LIMIT for power users with very large vaults.
3. Move heavy OCR + PDF generation to a background thread / WorkManager on Android to keep the UI thread fully responsive.

Biggest risk if no changes are made:
- For vaults beyond ~5 000 documents, FTS5 prefix matching will stay fast but backup/restore memory pressure may still spike due to in-memory Base64 zip generation.

---

#### Status — implemented optimizations (iterations 1 + 2)

| # | Optimization | Files | Iteration |
|---|---|---|---|
| 1 | Debounced drawer search; no `router.replace` per keystroke | `components/layout/CustomDrawerContent.tsx` | 1 |
| 2 | DB search rewritten: `EXISTS` subquery, hot-path indexes | `db/documents.ts`, `db/schema.ts` | 1 |
| 3 | FTS5 full-text index with triggers + `MATCH` search (LIKE fallback) | `db/schema.ts`, `db/documents.ts` | 2 |
| 4 | Prompt template sheet virtualized with `FlatList` | `components/ui/PromptTemplateSheet.tsx` | 1 |
| 5 | Backup zip cache cleanup + sequential restore writes | `services/BackupService.ts` | 1 |
| 6 | Backup creation preflight cap (100 MiB / 5 000 files) | `services/BackupService.ts` | 2 |
| 7 | Restore path sanitization, size caps, DoS hardening | `services/BackupService.ts` | 1 |
| 8 | OCR polling: cancellable `setTimeout` loop, adaptive backoff | `app/document/[id].tsx` | 1 |
| 9 | OCR multi-page progress: page-by-page percent overlay | `app/capture.tsx` | 2 |
| 10 | Dashboard tag fetching respects `fileTypeFilter` | `app/(drawer)/index.tsx` | 1 |
| 11 | Skip redundant JS sort when `sortBy === 'newest'` | `store/app-store.ts` | 1 |
| 12 | Precomputed timestamps in `sortDocumentsBy` (no repeated `new Date()` in comparator) | `store/app-store.ts` | 2 |
| 13 | Search result cap UX: banner shown when 200-row LIMIT is hit | `store/app-store.ts`, `app/(drawer)/index.tsx` | 2 |

In-App Purchase (RevenueCat): `react-native-purchases` SDK added; `PurchaseService.ts` wraps all RevenueCat calls. `PaywallModal` now triggers a real Google Play Billing sheet (with loading state) instead of a local `setIsPro(true)`. `loadSettings()` silently syncs entitlements on every launch so users who purchased on another device or restored outside the app still get Pro. Configuration is in `app.json > extra.revenueCatApiKey`. Native rebuild required.

Vault lock (UX / correctness, not search throughput): re-lock uses an AppState minimize→resume model with a minimum away duration and `store/auth-flags.ts` + `services/vaultLockPolicy.ts` so system sheets (pickers, share) and brief post-unlock OS transitions do not arm the timer incorrectly. **`app/capture.tsx`** keeps `systemPickerOpen` true for the full time that screen is mounted (coarser than per-call guards) so the Add Document flow does not trip the away timer. **`app/_layout.tsx`** defers AppState handling until settings have loaded and clears `systemPickerOpen` when returning active. Share/picker/OAuth entry points use `withExternalActivityGuard()` (see `Plan.md/AGENTS.md` for file list). Prior vault-lock debug/NDJSON ingest code was removed to avoid accidental telemetry. See `Plan.md/AGENTS.md` and `Plan.md/security.md` for behavior and threat-model notes.

---

### 2) Findings (Prioritized)

1. **Keystroke search triggers expensive work + navigation**
   - **Status**: RESOLVED
   - **Category**: Frontend
   - **Severity**: Critical
   - **Impact**: latency, throughput (DB + JS), battery, UX responsiveness
   - **Evidence**: `components/layout/CustomDrawerContent.tsx` debounces `runSearch(q)` in `handleSearch`; no `router.replace` on each keystroke.
   - **What was done**: 250 ms debounce window, flush-on-unmount, empty-query fast path.
   - **Expected impact**: High (2–10× fewer DB calls during typing)

2. **DB search degrades on large vaults (`%LIKE%`, no FTS)**
   - **Status**: RESOLVED
   - **Category**: DB
   - **Severity**: Critical
   - **Impact**: latency, battery, scalability
   - **Evidence**:
     - `db/schema.ts` — FTS5 virtual table `documents_fts` with external-content on `documents(title, notes, ocr_text)`. Triggers (`documents_fts_ai/ad/au`) keep the index in sync. Idempotent `rebuild` on every `initDb()`.
     - `db/documents.ts` — `searchDocuments()` builds an FTS5 `MATCH` expression (quoted prefix tokens) and queries `documents_fts` first. Falls back to `%LIKE%` if FTS5 is unavailable or the query fails.
     - Tag search still uses `EXISTS` + `LIKE` (tags are not in the FTS table).
     - Hot-path B-tree indexes on `documents(updated_at)`, `documents(category_id)`, `document_tags(document_id/tag_id)`, `tags(name)`.
   - **What was done**: FTS5 virtual table + triggers + `MATCH` search with graceful LIKE fallback.
   - **Expected impact**: High (token-based FTS5 MATCH is orders of magnitude faster than `%LIKE%` scans for large tables)

3. **Double-sorting in JS wastes CPU and allocations**
   - **Status**: RESOLVED
   - **Category**: CPU
   - **Severity**: High
   - **Impact**: CPU time, allocations, potential UI stutter on slower devices
   - **Evidence**:
     - `store/app-store.ts` — `runSearch()` skips `sortDocumentsBy` when `sortBy === 'newest'`.
     - `sortDocumentsBy()` now precomputes `new Date(updated_at).getTime()` once per document before sorting (no repeated `Date` construction in the comparator). Early return for single-element arrays.
   - **What was done**: Skip JS sort for SQL-ordered result; precompute timestamps; early-exit for trivial lists.
   - **Expected impact**: Medium-High (bigger effect on low-end devices and large result sets)

4. **Prompt templates UI renders all cards at once**
   - **Status**: RESOLVED
   - **Category**: Frontend
   - **Severity**: High
   - **Impact**: UI jank, memory usage, slow modal open/scroll
   - **Evidence**: `components/ui/PromptTemplateSheet.tsx` uses `FlatList` with `initialNumToRender`, `windowSize`, `removeClippedSubviews`.
   - **What was done**: Replaced `ScrollView` with `FlatList` virtualization.
   - **Expected impact**: Medium-High (modal responsiveness improvement)

5. **Backup zip creation may exhaust memory (Base64 + full in-memory zip)**
   - **Status**: MITIGATED
   - **Category**: Memory
   - **Severity**: Critical
   - **Impact**: OOM risk, slow backup times, UI freezes
   - **Evidence**: `services/BackupService.ts`:
     - `preflightBackup()` estimates archive size and file count before building the zip.
     - Hard caps: 100 MiB total / 5 000 files. `createBackup()` throws a descriptive error if limits are exceeded; the settings screen catches this and shows `Alert.alert`.
     - Zip cache files are deleted after sharing.
   - **What was done**: Pre-flight size/count gate; cache cleanup after share. In-memory Base64 zip generation remains (streaming not available in Expo).
   - **Remaining**: Stream-based zip generation would eliminate the in-memory peak entirely.
   - **Expected impact**: High (prevents OOM for realistic vaults; user sees clear error for oversized archives)

6. **Restore path traversal risk (security) + high concurrency write storm**
   - **Status**: RESOLVED
   - **Category**: Reliability / Security
   - **Severity**: Critical
   - **Impact**: security (path traversal), reliability (restore failures)
   - **Evidence**: `services/BackupService.ts`:
     - `toSafeFilename()` extracts basename only, rejects traversal patterns, reserved filenames, and entries exceeding length limits.
     - Sequential write loop (no `Promise.all` burst).
     - Hard caps: `MAX_ZIP_BYTES` (50 MiB), `MAX_MANIFEST_BYTES` (2 MiB), `MAX_CATEGORIES` (200), `MAX_DOCUMENTS` (5 000), `MAX_ARCHIVE_ENTRIES` (20 000), per-file uncompressed size check.
   - **What was done**: Full path sanitization, sequential writes, hard caps on all dimensions.
   - **Expected impact**: High (security + stability)

7. **OCR polling can overload DB and overlap async calls**
   - **Status**: RESOLVED
   - **Category**: Concurrency
   - **Severity**: High
   - **Impact**: CPU/DB usage, battery, potential race conditions
   - **Evidence**: `app/document/[id].tsx`:
     - Cancellable `setTimeout` loop (no async overlap).
     - Adaptive backoff: 1 s → 2 s → 3 s intervals.
   - **What was done**: Replaced `setInterval` with recursive `setTimeout`; adaptive backoff; cancel flag.
   - **Expected impact**: Medium (fewer DB calls, no overlap)

8. **OCR multi-page progress: no user feedback during text extraction**
   - **Status**: RESOLVED
   - **Category**: Frontend / UX
   - **Severity**: Medium
   - **Impact**: perceived performance, user confidence during long operations
   - **Evidence**: `app/capture.tsx`:
     - OCR extraction phase (0–50% of bar): shows "Reading text: page X of Y" with a percent.
     - Weak-page retry phase (50–60%): shows "Retrying N weak page(s)…"
     - PDF generation phase (60–100%): shows chunk/merge/finalize progress.
     - The long-operation overlay is shown immediately when OCR starts.
   - **What was done**: Page-by-page progress messages + percent updates during OCR; rebased PDF progress to 60–100%.
   - **Expected impact**: Medium (much better UX during multi-page scans)

9. **Home screen tags query may fetch tags for docs not currently displayed**
   - **Status**: RESOLVED
   - **Category**: I/O
   - **Severity**: Medium
   - **Impact**: DB query work, CPU, memory
   - **Evidence**: `app/(drawer)/index.tsx` — `useEffect` filters by `fileTypeFilter` before calling `getTagsForDocuments(ids)`.
   - **What was done**: Tag fetch scoped to displayed documents only; `fileTypeFilter` in dependency array.
   - **Expected impact**: Medium

10. **Search result cap UX: user unaware results are truncated**
    - **Status**: RESOLVED
    - **Category**: Frontend / UX
    - **Severity**: Medium
    - **Impact**: discoverability, user trust
    - **Evidence**:
      - `store/app-store.ts` — `searchResultCapped` boolean set when `searchDocuments` returns exactly `SEARCH_LIMIT` (200) rows.
      - `app/(drawer)/index.tsx` — informational banner: "Showing first N results. Refine your search for more."
    - **What was done**: Added `searchResultCapped` state and a result-cap banner above the document list.
    - **Expected impact**: Low-Medium (UX clarity)

---

### 3) Quick Wins (Do First)

All quick wins are implemented:

1. Debounce drawer search (no route replacement while typing) — `components/layout/CustomDrawerContent.tsx`
2. Avoid redundant JS sorting when `sortBy === 'newest'` — `store/app-store.ts`
3. Backup zip cache cleanup after sharing + sequential restore writes — `services/BackupService.ts`
4. Add hot-path indexes in `initDb()` — `db/schema.ts`
5. Replace `PromptTemplateSheet` `ScrollView` with `FlatList` virtualization — `components/ui/PromptTemplateSheet.tsx`
6. Precompute timestamps in `sortDocumentsBy` — `store/app-store.ts`
7. Search result cap banner — `store/app-store.ts`, `app/(drawer)/index.tsx`

---

### 4) Deeper Optimizations (Do Next)

All items from the original "Deeper Optimizations" list have been addressed:

| Original recommendation | Status |
|---|---|
| FTS5 for `title/notes/ocr_text` | Implemented (`db/schema.ts`, `db/documents.ts`) |
| `EXISTS` subquery for tag search | Implemented (`db/documents.ts`) |
| Search result limit | Implemented (200-row cap + UX banner) |
| Restore path sanitization + hardening | Implemented (`services/BackupService.ts`) |
| OCR polling adaptive backoff | Implemented (`app/document/[id].tsx`) |
| Backup pre-flight size/count check | Implemented (`services/BackupService.ts`) |
| OCR multi-page progress | Implemented (`app/capture.tsx`) |

**Future / remaining deeper optimizations:**

1. **Stream-based backup/restore**: Replace in-memory Base64 zip with a streaming approach (requires native module or Expo FileSystem stream API) to eliminate the peak memory spike for very large archives.
2. **Search pagination / infinite scroll**: Replace the hard 200-row LIMIT with cursor-based pagination so power users can scroll through thousands of results.
3. **Background OCR + PDF via WorkManager**: Move heavy native OCR and PDF generation off the JS thread entirely (Android WorkManager / iOS BGTaskScheduler) for a fully non-blocking UX.
4. **FTS5 column-filtered search**: When `includeOcr` is false, restrict the FTS5 `MATCH` to `{title notes}` columns only (currently falls back to LIKE for this case).
5. **Tag denormalization in FTS**: Add tag names to the FTS index so tag search also benefits from token-based matching instead of `LIKE`.

---

### 5) Validation Plan

Benchmarks (measure before/after):
1. **Search latency**
   - Setup: generate a dataset of N documents (e.g., 100, 1k, 5k) with tags and OCR text.
   - Measure: time from last keystroke to UI update (timestamp in `runSearch()` start/end).
   - Compare: LIKE-only vs FTS5 MATCH; debounced vs non-debounced.
2. **DB query timing**
   - Add temporary timing around `searchDocuments()` query execution.
   - Track: p50/p95 query duration for typical queries (`"receipt"`, `"warranty"`, partial OCR term).
3. **Backup/PDF memory and time**
   - Setup: archive with increasing sizes (50 docs, 200 docs, 500 docs).
   - Measure: end-to-end time for `createBackup()`, memory peak (Android Studio Profiler), preflight gate behavior.
4. **OCR polling behavior**
   - Measure: number of DB reads during a typical OCR completion window; time until OCR text appears in UI.
5. **OCR multi-page progress UX**
   - Verify: overlay appears immediately, page counter increments, percent bar reaches 100% at save completion.

Profiling strategy:
1. Android Studio Profiler: memory heap growth during backup and PDF export; CPU spikes during search.
2. React DevTools / performance overlay: confirm modal and scroll smoothness.

Metrics to compare before/after:
- Search: JS time per keystroke, total DB calls during typing, p95 query duration.
- Backup/PDF: peak memory, total time, leftover cache zip count.
- OCR: DB read count, UI update latency.

Test cases (correctness):
1. Search: title, notes, tag, and OCR matches all work; empty query returns to category/tag view; FTS5 fallback to LIKE works if FTS table is missing.
2. Sorting: `newest`, `oldest`, `expiring`, `name` produce correct ordering.
3. Backup/Restore: create → restore on clean state → documents match; preflight blocks oversized archives; restore rejects malicious zip entries.
4. OCR editor: polling stops at success and at max attempts; no crashes on unmount.
5. Search cap: banner appears when exactly 200 results returned; banner hidden when search is cleared.

---

### 6) Optimized Code / Patch

All patches below have been implemented in the codebase. They are preserved here as reference.

#### 6.1 FTS5 virtual table + triggers (db/schema.ts)

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  title, notes, ocr_text,
  content='documents', content_rowid='id'
);

-- Triggers: INSERT, DELETE, UPDATE keep FTS in sync
CREATE TRIGGER documents_fts_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, title, notes, ocr_text)
  VALUES (new.id, new.title, new.notes, new.ocr_text);
END;
CREATE TRIGGER documents_fts_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, notes, ocr_text)
  VALUES ('delete', old.id, old.title, old.notes, old.ocr_text);
END;
CREATE TRIGGER documents_fts_au AFTER UPDATE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, notes, ocr_text)
  VALUES ('delete', old.id, old.title, old.notes, old.ocr_text);
  INSERT INTO documents_fts(rowid, title, notes, ocr_text)
  VALUES (new.id, new.title, new.notes, new.ocr_text);
END;

-- Populate from existing data
INSERT INTO documents_fts(documents_fts) VALUES('rebuild');
```

#### 6.2 FTS5 MATCH search with LIKE fallback (db/documents.ts)

```ts
function buildFtsMatchExpr(query: string): string {
  const tokens = query
    .replace(/['"*(){}[\]^~!@#$%&|\\:;,.?/<>+=]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return '';
  return tokens.map((t) => `"${t}"*`).join(' OR ');
}

// In searchDocuments():
const ftsExpr = buildFtsMatchExpr(query);
if (ftsExpr) {
  try {
    return await db.getAllAsync<Document>(
      `SELECT d.* FROM documents d
       WHERE d.id IN (SELECT rowid FROM documents_fts WHERE documents_fts MATCH ?)
         OR EXISTS (SELECT 1 FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
                    WHERE dt.document_id = d.id AND t.name LIKE ?)
       ORDER BY d.updated_at DESC LIMIT ?`,
      [ftsExpr, like, safeLimit]
    );
  } catch { /* fall through to LIKE */ }
}
```

#### 6.3 Backup preflight cap (services/BackupService.ts)

```ts
export async function preflightBackup(): Promise<BackupPreflightResult> {
  // Scan archive dir for total bytes + file count
  // Enforce: 100 MiB / 5000 files
  // createBackup() calls preflight and throws if !ok
}
```

#### 6.4 Precomputed sort timestamps (store/app-store.ts)

```ts
case 'newest':
case 'oldest': {
  const stamped = docs.map((d) => ({ d, ms: new Date(d.updated_at).getTime() }));
  stamped.sort((a, b) => (sortBy === 'newest' ? b.ms - a.ms : a.ms - b.ms));
  return stamped.map((s) => s.d);
}
```

#### 6.5 Search result cap UX (store/app-store.ts + app/(drawer)/index.tsx)

```ts
// store: searchResultCapped boolean set when list.length >= SEARCH_LIMIT
// index: banner with "Showing first N results. Refine your search for more."
```

#### 6.6 OCR page-by-page progress (app/capture.tsx)

```ts
// OCR phase (0-50%):
setLongOpMessage(`Reading text: page ${pageIndex + 1} of ${totalPages}`);
setLongOpPercent(Math.round((pageIndex / totalPages) * 50));

// Retry phase (50-60%):
setLongOpMessage(`Retrying ${weakPageIndexes.length} weak page(s)…`);

// PDF phase (60-100%): rebased from previous 0-100
const PDF_BASE_PCT = 60;
```

#### 6.7 Earlier patches (iteration 1, preserved for reference)

- **Debounce drawer search**: 250 ms debounce, flush-on-unmount, empty-query fast path.
- **EXISTS subquery**: Replaced `LEFT JOIN + DISTINCT` with `EXISTS` for tag matching.
- **Hot-path indexes**: `documents(updated_at, category_id)`, `document_tags(document_id, tag_id)`, `tags(name)`.
- **FlatList virtualization**: `PromptTemplateSheet` with `initialNumToRender`, `windowSize`, `removeClippedSubviews`.
- **Backup cleanup**: `LegacyFS.deleteAsync(zipPath)` in `finally` blocks.
- **Restore hardening**: `toSafeFilename()`, sequential writes, hard caps on all dimensions.
- **OCR setTimeout loop**: Cancellable recursive poll with adaptive backoff.
- **Filtered tag fetch**: `fileTypeFilter` scoping before `getTagsForDocuments()`.
- **Skip newest sort**: `runSearch` bypasses `sortDocumentsBy` when `sortBy === 'newest'`.
