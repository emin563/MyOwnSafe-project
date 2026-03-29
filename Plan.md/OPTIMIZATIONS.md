### 1) Optimization Summary

Overall, the app is well-structured for an offline-first, local-SQLite workflow, but it currently has several high-ROI performance hotspots:
- Search/filters can cause excessive work on every keystroke and trigger unnecessary navigation.
- Database search is likely to degrade quickly as the vault grows because `%LIKE%` + tag joins run without supporting indexes/FTS.
- Heavy flows (backup/restore, PDF export) can create significant memory pressure due to Base64 + full in-memory zips.

Top 3 highest-impact improvements:
1. Debounce and de-couple search from navigation (avoid `router.replace` on every keystroke).
2. Make DB search faster: add relevant SQLite indexes and consider an FTS5 strategy for `title/notes/ocr_text` + tag search.
3. Prevent memory spikes and cache bloat in `BackupService` (sanitize zip paths, reduce restore write concurrency, and clean up generated zip files).

Biggest risk if no changes are made:
- As document count grows, search latency and UI jank will likely increase non-linearly, and backups/PDF exports may become unstable or trigger Android memory pressure/OOM.

Status note (implemented in this iteration):
- Drawer search is debounced and no longer performs `router.replace` while typing.
- DB search was rewritten to avoid `JOIN + DISTINCT` and is supported by hot-path SQLite indexes.
- Prompt template browsing uses `FlatList` virtualization.
- Backup cache zips are cleaned up after sharing and restore writes are sequential (lower memory/disk concurrency).
- OCR polling uses a cancellable `setTimeout` loop (no overlapping async interval).
- Dashboard tag fetching respects the current file-type filter.

Vault lock (UX / correctness, not search throughput): re-lock uses an AppState minimize→resume model with a minimum away duration and `store/auth-flags.ts` + `services/vaultLockPolicy.ts` so system sheets (pickers, share) and brief post-unlock OS transitions do not arm the timer incorrectly. **`app/capture.tsx`** keeps `systemPickerOpen` true for the full time that screen is mounted (coarser than per-call guards) so the Add Document flow does not trip the away timer. **`app/_layout.tsx`** defers AppState handling until settings have loaded and clears `systemPickerOpen` when returning active. Share/picker/OAuth entry points use `withExternalActivityGuard()` (see `Plan.md/AGENTS.md` for file list). Prior vault-lock debug/NDJSON ingest code was removed to avoid accidental telemetry. See `Plan.md/AGENTS.md` and `Plan.md/security.md` for behavior and threat-model notes.

---

### 2) Findings (Prioritized)

1. **Keystroke search triggers expensive work + navigation**
   - **Title (updated)**: Keystroke search is now debounced; typing no longer triggers route replacement per character
   - **Category**: Frontend
   - **Severity**: Critical
   - **Impact**: latency, throughput (DB + JS), battery, UX responsiveness
   - **Evidence (updated)**: `[components/layout/CustomDrawerContent.tsx](components/layout/CustomDrawerContent.tsx)` now debounces `runSearch(q)` in `handleSearch` and `handleSearch` no longer calls `router.replace('/(drawer)')` on each keystroke.
   - **Why it’s inefficient**: Every character typed causes:
     - immediate SQLite `%LIKE%` search execution
     - additional re-renders of the drawer/dashboard tree
   - **Recommended fix**:
     - Keep the debounce window (~250ms) and flush the last query on unmount (implemented).
     - Optionally ignore queries shorter than N chars or handle empty query as a separate path.
   - **Tradeoffs / Risks**: Slightly delayed UI updates while typing; ensure cancel-on-unmount and immediate update on blur/submit.
   - **Expected impact estimate**: High (often 2–10x fewer DB calls during typing; noticeably smoother typing)
   - **Removal Safety**: Safe
   - **Reuse Scope**: local to drawer search handler

2. **DB search likely does a full scan due to `%LIKE%` and missing indexes**
   - **Title (updated)**: SQLite search still uses `%LIKE%` substring matching, but tag matching is now `EXISTS`-based and supported by hot-path indexes (FTS5 remains next)
   - **Category**: DB
   - **Severity**: Critical
   - **Impact**: latency, battery, scalability as vault size increases
   - **Evidence**:
     - `[db/documents.ts](db/documents.ts)` `searchDocuments()` rewrites tag matching to an `EXISTS` subquery (no `JOIN + DISTINCT` row explosion) and still applies `LIKE '%{query}%'` to `d.title`, `d.notes`, and optionally `d.ocr_text`, ordered by `d.updated_at DESC`.
     - `[db/schema.ts](db/schema.ts)` `initDb()` now creates hot-path indexes for search/joins (`documents(updated_at)`, `documents(category_id)`, `document_tags(document_id/tag_id)`, `tags(name)`).
   - **Why it’s inefficient**:
     - `%term%` disables normal index usefulness for most B-tree indexes.
     - Tag search still relies on `%LIKE%` (so it will scale with vault size), but the previous join+distinct overhead is avoided via `EXISTS`.
   - **Recommended fix**:
     - Add supporting indexes (at minimum for join keys and `updated_at`):
       - `document_tags(document_id)`, `document_tags(tag_id)`
       - `documents(updated_at)` and consider `documents(category_id)`
       - `tags(name)` (may already be indexed via `UNIQUE`, but confirm)
     - For best results, implement FTS5:
       - Use `fts5(title, notes, ocr_text)` for fast substring-ish queries (with `MATCH`).
       - Optionally model tag search separately or denormalize tag names into an FTS table keyed by `documents.id`.
     - Reduce DISTINCT overhead:
       - Replace tag joins with `EXISTS` subqueries (already implemented).
   - **Tradeoffs / Risks**:
     - FTS5 adds complexity and requires keeping the FTS table in sync (triggers or manual updates).
     - Index additions must be done safely in `initDb()` and won’t break existing installs.
   - **Expected impact estimate**: High (especially for large vaults; can turn seconds into tens of milliseconds)
   - **Removal Safety**: Likely Safe (indexes/FTS changes require verification)
   - **Reuse Scope**: DB schema + `searchDocuments()` implementation

3. **Double-sorting in JS wastes CPU and allocations**
   - **Title**: Search results are ordered in SQL and re-sorted again in JS
   - **Category**: CPU
   - **Severity**: High
   - **Impact**: CPU time, allocations, potential UI stutter on slower devices
   - **Evidence**:
     - `[db/documents.ts](db/documents.ts)` `searchDocuments()` ends with `ORDER BY d.updated_at DESC`.
     - `[store/app-store.ts](store/app-store.ts)` `runSearch()` now skips `sortDocumentsBy` when `sortBy === 'newest'` (uses SQL ordering directly).
     - `[store/app-store.ts](store/app-store.ts)` `sortDocumentsBy()` recreates `Date` objects inside comparator for every compare (e.g., `new Date(b.updated_at).getTime()`).
   - **Why it’s inefficient**:
     - Sorting is `O(n log n)` and comparator allocs can dominate for larger `n`.
     - The SQL ordering is already “newest”; JS sort repeats it.
   - **Recommended fix**:
     - For `sortBy === 'newest'`, skip JS sort and use SQL ordering as-is.
     - For `sortBy === 'oldest'`, either:
       - change `searchDocuments()` to order based on sortBy, or
       - add a branch in `runSearch()` to query for oldest.
     - Precompute timestamps once per document list (create `updatedAtMs` field in the query/store mapping) to reduce comparator allocations.
   - **Tradeoffs / Risks**: Must ensure stable semantics for all sorts (`expiring`, `name`) and OCR inclusion.
   - **Expected impact estimate**: Medium-High (bigger effect when results are large or on low-end devices)
   - **Removal Safety**: Needs Verification (correctness for each sort mode)
   - **Reuse Scope**: store-wide search + sorting logic

4. **Prompt templates UI renders all cards at once**
   - **Title (updated)**: Prompt library browsing uses `FlatList` virtualization (reduces modal jank for many templates)
   - **Category**: Frontend
   - **Severity**: High
   - **Impact**: UI jank, memory usage, slow modal open/scroll
   - **Evidence (updated)**: `[components/ui/PromptTemplateSheet.tsx](components/ui/PromptTemplateSheet.tsx)` now uses `FlatList` virtualization (only renders a window of ~100 templates).
   - **Why it’s inefficient**:
     - Rendering 100 templates creates a large component tree.
     - On lower-memory Android devices, modal open/scroll can stutter.
   - **Recommended fix**:
     - Replace `ScrollView` with `FlatList` virtualization (`renderItem`, `keyExtractor`).
     - Add `initialNumToRender`, `windowSize`, and `removeClippedSubviews` where appropriate.
   - **Tradeoffs / Risks**: Slightly more code; ensure nested gesture/touch interactions with `Modal` remain correct.
   - **Expected impact estimate**: Medium-High (modal responsiveness improvement)
   - **Removal Safety**: Likely Safe (UI refactor)
   - **Reuse Scope**: prompt sheet component

5. **Backup zip creation may exhaust memory (Base64 + full in-memory zip)**
   - **Title**: Backup builds large Base64 payloads and generates zip fully in memory
   - **Category**: Memory
   - **Severity**: Critical
   - **Impact**: OOM risk, slow backup times, UI freezes if not isolated
   - **Evidence**: `[services/BackupService.ts](services/BackupService.ts)`:
     - Reads each archive file via `readAsStringAsync(... Base64)` and adds to `JSZip` as Base64.
     - Generates the full archive with `zip.generateAsync({ type: 'base64' })` and writes that full Base64 string to disk.
   - **Why it’s inefficient**:
     - Base64 inflates size (~33%).
     - `JSZip` keeps file payloads in memory until `generateAsync` completes.
   - **Recommended fix**:
     - Add safety limits:
       - hard cap total archive size (use `[services/StorageService.ts](services/StorageService.ts)` `getArchiveSize()` or new helper) and/or cap number of files.
       - refuse or require Pro for large zips.
     - Add progress + yield (avoid long blocking loops in JS).
     - Consider generating zip as binary/blob where possible (Expo/RN constraints apply), or reduce Base64 conversions.
     - After sharing, delete the generated zip file to avoid cache growth (implemented).
   - **Tradeoffs / Risks**: Limits may frustrate users with very large archives; must communicate size expectations.
   - **Expected impact estimate**: High (stability; prevents OOM/cache bloat)
   - **Removal Safety**: Needs Verification (zip generation compatibility)
   - **Reuse Scope**: backup and selected-document share flows

6. **Restore path traversal risk (security) + high concurrency write storm**
   - **Title (updated)**: Restore writes sequentially and uses basename-only destination paths (reduces traversal/corruption risk)
   - **Category**: Reliability
   - **Severity**: Critical
   - **Impact**: security (path traversal), reliability (restore failures), device integrity
   - **Evidence**: `[services/BackupService.ts](services/BackupService.ts)` restore:
     - Writes archive entries sequentially (no large `Promise.all` concurrency burst).
     - Derives destination path using only the basename (`ARCHIVE_DIR + safeName`) to reduce path traversal / restore corruption vectors.
   - **Why it’s inefficient**:
     - Zip entries can be malicious: `relativePath` might contain `../` or absolute paths.
     - Path traversal could write outside the intended `archive/` directory.
     - Many concurrent writes can spike memory/disk usage; sequential restore reduces the spike.
   - **Recommended fix**:
     - Sanitize zip entry paths:
       - Reject paths containing `..`, path separators (`/` or `\`), or starting with `/`.
       - Optionally enforce “single filename only” because your archive writes as `archive/${fileName}`.
     - Use limited concurrency or sequential writes:
       - `for...of await` or concurrency limit (e.g., 2–4 at a time).
   - **Tradeoffs / Risks**: If older backups include nested directories, strict sanitization might skip some files. Mitigate by supporting safe nested paths but always strip traversal segments.
   - **Expected impact estimate**: High (security + stability)
   - **Removal Safety**: Needs Verification (backup compatibility)
   - **Reuse Scope**: restore path handling

7. **OCR polling can overload DB and overlap async calls**
   - **Title (updated)**: OCR editor uses a cancellable `setTimeout` polling loop (no async overlap)
   - **Category**: Concurrency
   - **Severity**: High
   - **Impact**: CPU/DB usage, battery, potential race conditions
   - **Evidence**: `[app/document/[id].tsx](app/document/[id].tsx)`:
     - Replaced the async `setInterval` with a cancellable `setTimeout` poll loop (next poll scheduled after the awaited DB read completes).
     - Up to 15 attempts; overlap risk is removed by construction.
   - **Why it’s inefficient**:
     - `setInterval` does not wait for async completion, so it can create overlapping DB calls.
     - Multiple re-renders/effect re-runs (dependency changes) could increase churn if cleanup timing differs.
   - **Recommended fix**:
     - Replace with a recursive `setTimeout` loop that schedules the next poll only after the previous one completes.
     - Add an “abort/cancel” flag in cleanup to avoid state updates after unmount.
   - **Tradeoffs / Risks**: Must keep polling UX identical; ensure cleanup works reliably.
   - **Expected impact estimate**: Medium (reduces DB calls; less jank)
   - **Removal Safety**: Likely Safe
   - **Reuse Scope**: OCR polling logic in document editor

8. **Home screen tags query may fetch tags for docs not currently displayed**
   - **Title (updated)**: Tag map effect respects `fileTypeFilter` before fetching tags
   - **Category**: I/O
   - **Severity**: Medium
   - **Impact**: DB query work, CPU, memory
   - **Evidence**: `[app/(drawer)/index.tsx](app/(drawer)/index.tsx)`:
     - `useEffect` now filters by the current `fileTypeFilter` before calling `getTagsForDocuments(ids)`.
     - The effect dependency list includes `fileTypeFilter`, preventing stale/extra tag fetches.
   - **Why it’s inefficient**:
     - When users filter by file type, you still fetch tags for all docs in the selected category/search set.
   - **Recommended fix**:
     - Compute `displayedDocuments` earlier and use `displayedDocuments.map(d => d.id)` for tag fetches.
     - Update the effect dependencies to include `fileTypeFilter`.
   - **Tradeoffs / Risks**: More frequent fetches when `fileTypeFilter` changes, but typically far fewer than loading tags for all docs.
   - **Expected impact estimate**: Medium
   - **Removal Safety**: Safe
   - **Reuse Scope**: dashboard list path

---

### 3) Quick Wins (Do First)

1. Implemented: debounce drawer search (no route replacement while typing) (`[components/layout/CustomDrawerContent.tsx](components/layout/CustomDrawerContent.tsx)`).
2. Implemented: avoid redundant JS sorting when `sortBy === 'newest'` (`[store/app-store.ts](store/app-store.ts)`).
3. Implemented: backup zip cache cleanup after sharing + sequential restore writes (`[services/BackupService.ts](services/BackupService.ts)`).
4. Implemented: add minimal hot-path indexes in `initDb()` (`[db/schema.ts](db/schema.ts)`).
5. Implemented: replace `PromptTemplateSheet` `ScrollView` with `FlatList` virtualization (`[components/ui/PromptTemplateSheet.tsx](components/ui/PromptTemplateSheet.tsx)`).

---

### 4) Deeper Optimizations (Do Next)

1. Switch from `%LIKE%` search to SQLite FTS5:
   - Create an FTS table for `title`, `notes`, and `ocr_text`.
   - Keep it in sync via triggers or manual updates.
   - Handle tag search via denormalization or a two-step query (find matching tag IDs -> filter documents).
2. Already implemented: `searchDocuments()` now uses `EXISTS` (avoids `JOIN + DISTINCT` row explosion). Next step is FTS5 (below) for much faster `%LIKE%`-style substring matching.
3. Add a search result limit (and optionally pagination) to cap worst-case UI freezes for large vaults.
4. Harden `restoreFromBackup()`:
   - sanitize zip entry names
   - enforce safe archive write paths
   - apply limited concurrency writes
5. Next: reduce OCR polling work further (overlap is fixed already; consider adaptive backoff / longer intervals):
   - longer poll intervals after the first few failures
   - or a single “check after save” approach tied to known OCR completion signals (if available).

---

### 5) Validation Plan

Benchmarks (measure before/after):
1. **Search latency**
   - Setup: generate a dataset of N documents (e.g., 100, 1k, 5k) with tags and OCR text.
   - Measure: time from last keystroke to UI update (e.g., timestamp in `runSearch()` start/end and when `set({ documents: ... })` completes).
   - Compare:
     - current behavior
     - debounced search (e.g., 250ms)
     - indexed/FTS search (after schema changes)
2. **DB query timing**
   - Add temporary timing around `searchDocuments()` query execution (local instrumentation).
   - Track: p50/p95 query duration for typical queries (`"receipt"`, `"warranty"`, partial OCR term).
3. **Backup/PDF memory and time**
   - Setup: archive with increasing sizes (e.g., 50 docs, 200 docs) and mixed image/PDF.
   - Measure on-device:
     - end-to-end time for `createBackup()` and `shareSelectedDocuments()`
     - memory peak (Android Studio Profiler: JS heap + native memory)
     - cache directory growth (generated zip files count).
4. **OCR polling behavior**
   - Measure:
     - number of DB reads during a typical OCR completion window
     - time until OCR text appears in UI
     - check for overlapping queries (use instrumentation counter).

Profiling strategy:
1. Android Studio Profiler:
   - Memory heap growth during backup and PDF export.
   - CPU spikes during search and sorting.
2. React DevTools / performance overlay:
   - confirm that modal opening and scrolling stays smooth after prompt sheet changes.

Metrics to compare before/after:
1. Search:
   - JS time per keystroke (or after debounce)
   - total number of DB calls during typing
   - p95 query duration
2. Backup/PDF:
   - peak memory
   - total time to complete
   - leftover cache zip count
3. OCR:
   - DB read count
   - UI update latency (OCR text becomes visible)

Test cases (correctness):
1. Search:
   - title matches, notes matches, tag matches, and OCR matches all still work.
   - empty query returns to category/tag view.
2. Sorting:
   - `newest`, `oldest`, `expiring`, and `name` produce correct ordering for the same data.
3. Backup/Restore:
   - create backup -> restore on a clean state -> documents count and metadata match.
   - restore with special zip entry names (ensure they are rejected/sanitized without breaking restore).
4. OCR editor:
   - after save, polling stops at success and stops at max attempts.
   - no crashes on unmount/back navigation mid-poll.

---

### 6) Optimized Code / Patch (when possible)

The following snippets are patch-ready suggestions (some were implemented in this iteration; remaining suggestions focus on next-step refactors).

#### 6.1 Debounce drawer search + remove route replacement

```tsx
// In components/layout/CustomDrawerContent.tsx
// Idea: debounce runSearch and remove router.replace on every keystroke.
const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

const handleSearch = (q: string) => {
  setSearchQuery(q);

  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  searchDebounceRef.current = setTimeout(() => {
    runSearch(q);
    // Remove: router.replace('/(drawer)')
  }, 250);
};

// Optional: flush debounce on unmount
React.useEffect(() => {
  return () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  };
}, []);
```

#### 6.2 Avoid double-sorting on `newest`

```ts
// In store/app-store.ts (inside runSearch)
const list = await searchDocuments(query, true);

if (get().sortBy === 'newest') {
  // searchDocuments already orders by updated_at DESC
  set({ documents: list });
  return;
}

const sorted = sortDocumentsBy(list, get().sortBy);
set({ documents: sorted });
```

#### 6.3 Add supporting indexes (minimal, safe)

```sql
-- In db/schema.ts initDb() (executed via database.execAsync)
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags(tag_id);
-- tags.name may already be indexed due to UNIQUE, but this is harmless:
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
```

#### 6.4 Use EXISTS instead of JOIN+DISTINCT for tag match

```sql
-- Replace the tag join section in searchDocuments()
-- Current pattern:
--   LEFT JOIN document_tags dt ...
--   LEFT JOIN tags t ...
--   WHERE ... OR t.name LIKE ?
-- With:
--   WHERE ... OR EXISTS (
--     SELECT 1 FROM document_tags dt
--     JOIN tags t ON t.id = dt.tag_id
--     WHERE dt.document_id = d.id AND t.name LIKE ?
--   )
```

#### 6.5 Prompt sheet: replace ScrollView with FlatList virtualization

```tsx
// In components/ui/PromptTemplateSheet.tsx
// Replace ScrollView + templates.map(...) with FlatList.
<FlatList
  data={templates}
  keyExtractor={(t) => t.id}
  contentContainerStyle={styles.listContent}
  renderItem={({ item: t }) => (
    <View style={styles.card}>
      {/* existing card UI */}
    </View>
  )}
  initialNumToRender={12}
  windowSize={7}
  removeClippedSubviews
/>
```

#### 6.6 Backup: delete generated zip files + limit size

```ts
// In services/BackupService.ts after Sharing.shareAsync(zipPath)
try {
  await Sharing.shareAsync(zipPath, { mimeType: 'application/zip', dialogTitle: ... });
} finally {
  // Use LegacyFS.deleteAsync(zipPath, { idempotent: true }) or best available RN API
}
```

#### 6.7 Restore: sanitize zip paths + limit concurrency

```ts
// In services/BackupService.ts restoreFromBackup() archiveEntries loop:
const safeDestUriForRelativePath = (relativePath: string) => {
  // Because you write as `archive/${fileName}`, you should expect a single filename segment.
  const normalized = relativePath.replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.startsWith('/') || normalized.includes('/')) {
    return null; // skip unsafe entries
  }
  return `${ARCHIVE_DIR}${normalized}`;
};

// Replace Promise.all(filePromises) with sequential or limited concurrency:
for (const relativePath in /* zip archive entries collection */) {
  const safeUri = safeDestUriForRelativePath(relativePath);
  if (!safeUri) continue;
  const base64Content = await file.async('base64');
  await LegacyFS.writeAsStringAsync(safeUri, base64Content, { encoding: LegacyFS.EncodingType.Base64 });
}
```

#### 6.8 OCR polling: replace setInterval with sequential setTimeout

```ts
// In app/document/[id].tsx
let cancelled = false;
let attempts = 0;

const poll = async () => {
  if (cancelled) return;
  attempts += 1;

  const doc = await getDocumentById(docId);
  const t = doc?.ocr_text;
  if (t && t.trim().length > 0) {
    setOcrText(t);
    setOcrAwaiting(false);
    return;
  }
  if (attempts >= 15) {
    setOcrAwaiting(false);
    return;
  }

  setTimeout(poll, 2000);
};

setOcrAwaiting(true);
poll();

return () => { cancelled = true; };
```

