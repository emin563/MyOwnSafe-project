# Optimization Report — PromptBlueprint (Vault)

> Last full scan: **2026-04-18**
> Scope: `store/`, `db/`, `app/`, `components/`, `services/`, `config/`, `theme/`, `constants/`, `package.json`, build config

---

## Part 1 — Previously Implemented Fixes (2026-04-11 → 2026-04-18)

Status after previous passes: **86 / 100**

### §1  Bulk operation reload batching
- `skipReload` option on `addDocument` / `editDocument` / `removeDocument`.
- Bulk delete, move, import-review reload once at end.
- **Files:** `store/app-store.ts`, `app/(drawer)/index.tsx`, `app/document/import-review.tsx`

### §2  Narrow Zustand subscriptions
- `useShallow` selectors on hot screens.
- **Files:** `app/(drawer)/index.tsx`, `DocumentCard.tsx`, `CustomDrawerContent.tsx`, `PromptTemplateSheet.tsx`, `_layout.tsx`, `settings.tsx`, `[id].tsx`, `import-review.tsx`

### §3  Selection lookup optimization
- `selectedIdSet` (Set-based O(1) membership).
- **Files:** `app/(drawer)/index.tsx`

### §4  List render stability
- Memoized `renderDocument`, `ItemSeparatorComponent`, pre-resolved category in `DocumentCard`.
- **Files:** `app/(drawer)/index.tsx`, `DocumentCard.tsx`

### §5  Settings hydration batching
- `getSettings(keys[])` single SQL query.
- **Files:** `db/settings.ts`, `store/app-store.ts`

### §6  Duplicate tag copy batching
- `addTagsToDocument(documentId, tagIds)`.
- **Files:** `db/tags.ts`, `store/app-store.ts`

### §7  OCR trial write consolidation
- `consumeOcrReadTrials(count)`.
- **Files:** `store/app-store.ts`

### §8  PDF temp chunk cleanup
- `scan_chunk_*` cleanup in `finally`.
- **Files:** `services/PdfService.ts`

### §9  Drawer renderer stabilization
- Memoized drawer content render function.
- **Files:** `app/(drawer)/_layout.tsx`

### §10  Bulk tag batching
- `addTagToDocuments(documentIds, tagId)` — single `INSERT OR IGNORE`.
- **Files:** `db/tags.ts`, `store/app-store.ts`, `app/(drawer)/index.tsx`

### §11  Tag map fetch dedupe
- `visibleDocIdsSignature` (sorted comma-joined IDs); `useEffect` depends on signature only.
- **Files:** `app/(drawer)/index.tsx`

### §12  Zip progress callback throttling
- `shouldEmitBackupProgress` (120 ms throttle, guaranteed on phase change).
- **Files:** `services/backupProgressThrottle.ts`, `app/settings.tsx`, `app/(drawer)/index.tsx`

### §13  Photo library access mode session cache
- ~5 s in-memory cache for `getPhotoLibraryAccessMode()`.
- **Files:** `services/photoAccessMode.ts`

---

## Part 2 — Full Optimization Scan (2026-04-18)

Total findings: **88**
- Critical: **10**  |  High: **23**  |  Medium: **33**  |  Low: **22**

---

### A) CRITICAL

#### A1 · `DocumentCard` not wrapped in `React.memo`
- **Category:** Frontend / Rerender
- **File:** `components/document/DocumentCard.tsx`
- **Evidence:** Exported as plain function. Every `HomeScreen` re-render re-renders every card in the FlatList.
- **Impact:** Janky scrolling on 25+ documents, dropped frames.
- **Fix:** Wrap export with `React.memo`.

#### A2 · `DocumentCard` opens its own Zustand subscription per instance
- **Category:** Rerender / Memory
- **File:** `components/document/DocumentCard.tsx` ~L46-54
- **Evidence:** Each card subscribes via `useShallow` for `categories`, `removeDocument`, `editDocument`, `duplicateDocument`, `showToast`. N cards = N subscriptions; any `categories` change re-renders all cards.
- **Impact:** Multiplied equality checks and re-renders on every store write.
- **Fix:** Pass `category` and action callbacks as props from parent. Lift the subscription out of the card.

#### A3 · FlatList missing performance props
- **Category:** Frontend / UX
- **File:** `app/(drawer)/index.tsx` ~L515-522
- **Evidence:** No `getItemLayout`, `windowSize`, `maxToRenderPerBatch`, `removeClippedSubviews`, `initialNumToRender`.
- **Impact:** Every scroll triggers layout measurement; off-screen cards stay mounted.
- **Fix:** Add `removeClippedSubviews={true}`, `windowSize={5}`, `maxToRenderPerBatch={8}`, `initialNumToRender={8}`, and a `getItemLayout` using a known card height constant.

#### A4 · Peak memory 3-4× archive size during backup creation
- **Category:** Memory
- **File:** `services/BackupService.ts` ~L322-361
- **Evidence:** All files read as base64 into JSZip, then entire zip generated as another base64 string, then written to disk. For 100 MiB archive → ~400 MiB JS heap peak.
- **Impact:** OOM crash on low-RAM Android near the 100 MiB cap.
- **Fix:** Replace JSZip with a native zip module (`react-native-blob-util` / `react-native-zip-archive`) that writes directly to disk, or stream sub-archives. At minimum, null-out references between steps to let GC reclaim.

#### A5 · Full zip loaded into memory during restore
- **Category:** Memory
- **File:** `services/BackupService.ts` ~L411-415
- **Evidence:** `readAsStringAsync` (base64) → `JSZip.loadAsync`. Both the base64 string (~67 MiB for 50 MiB zip) and parsed JSZip object live simultaneously.
- **Impact:** ~3× zip size peak memory; OOM risk.
- **Fix:** Use a native unzip library to extract directly to staging directory, avoiding JS-heap base64. If JSZip required, null-out base64 string immediately after `loadAsync`.

#### A6 · Unused `mammoth` dependency (~400 KB)
- **Category:** Bundle Size
- **File:** `package.json`
- **Evidence:** Zero imports anywhere. Word preview uses custom XML parsing via JSZip in `offlinePreview.ts`.
- **Fix:** Remove from `dependencies`.

#### A7 · Unused `cfb` dependency (~80 KB)
- **Category:** Bundle Size
- **File:** `package.json`
- **Evidence:** Zero imports. Excel preview uses JSZip + XML parsing.
- **Fix:** Remove from `dependencies`.

#### A8 · Unused `deprecated-react-native-prop-types` (~50 KB)
- **Category:** Bundle Size
- **File:** `package.json`
- **Evidence:** RN 0.81 compat shim for RN 0.69-0.72; zero imports.
- **Fix:** Remove from `dependencies`.

#### A9 · Unused `react-native-worklets` (native C++ code)
- **Category:** Bundle Size / Build
- **File:** `package.json`
- **Evidence:** Zero imports. Includes native binaries compiled into every build.
- **Impact:** Extra APK size, build time, JNI overhead at startup.
- **Fix:** Remove from `dependencies`.

#### A10 · `initDb` seeds categories with sequential INSERTs, no transaction
- **Category:** DB
- **File:** `db/schema.ts` ~L144-149
- **Evidence:** Loop of 4 `await db.runAsync('INSERT...')` with auto-commit per row. No rollback on partial failure.
- **Fix:** Wrap in `BEGIN/COMMIT` or single multi-row INSERT.

---

### B) HIGH

#### B1 · Inline closures in `renderDocument` defeat `React.memo`
- **File:** `app/(drawer)/index.tsx` ~L278-279
- **Evidence:** `onLongPress={() => handleCardLongPress(item.id)}` creates a new function per render.
- **Fix:** Pass `item.id` as prop; handle callback inside card or use a stable callback pattern.

#### B2 · `?? []` creates new empty array for tags on every render
- **File:** `app/(drawer)/index.tsx` ~L276
- **Evidence:** `documentTagsMap[item.id] ?? []` — a new `[]` per card if no tags.
- **Fix:** Module-level `const EMPTY_TAGS: Tag[] = []`; use `?? EMPTY_TAGS`.

#### B3 · `CaptureScreen` — 20+ individual `useAppStore` subscriptions
- **File:** `app/capture.tsx` ~L145-164
- **Evidence:** Each `useAppStore(s => s.xxx)` opens a separate subscription → 20+ equality checks per store mutation.
- **Fix:** Consolidate into one `useShallow` call.

#### B4 · `CameraTab` / `ImportTab` not memoized
- **File:** `app/capture.tsx` ~L1534, ~L1761
- **Evidence:** Plain functions; parent re-render re-renders inactive tab.
- **Fix:** Wrap with `React.memo`.

#### B5 · `DocumentEditorScreen` cascading `useEffect` chains
- **File:** `app/document/[id].tsx` ~L206-340
- **Evidence:** 8 effects, several cascade (`ocrText` change → reset page/zoom/search → trigger another effect). 2-3 extra render passes on load.
- **Fix:** Merge OCR-related effects; derive resets via `useMemo` key pattern.

#### B6 · OCR polling effect includes `ocrText` in deps — restarts on own success
- **File:** `app/document/[id].tsx` ~L340
- **Evidence:** `setOcrText(t)` changes dep → tears down + re-creates effect.
- **Fix:** Use a ref to track OCR text presence.

#### B7 · `SettingsScreen` monolithic — 25+ state vars
- **File:** `app/settings.tsx` ~L96-123
- **Evidence:** Any single state change re-renders the entire 1600-line component.
- **Fix:** Extract dev-tools / regression / OCR QA sections into memoized sub-components.

#### B8 · `removeCategory` triggers two sequential full-table reloads
- **File:** `store/app-store.ts` ~L604-612
- **Evidence:** `await loadCategories()` then `await loadDocuments()` → 2 DB queries + 2 `set()` + 2 re-render cycles.
- **Fix:** `Promise.all` or merge into single `set()`.

#### B9 · `getOrCreateTag` triple query + TOCTOU race
- **File:** `store/app-store.ts` ~L679-690 + `db/tags.ts` ~L116-126
- **Evidence:** Store calls `getTagIdByName` (1 query); if miss, calls `getOrCreateTagByName` which does the same SELECT again + INSERT = 3 queries. Race between count check and INSERT.
- **Fix:** Single `INSERT OR IGNORE` + `SELECT` pattern. Transaction for limit check.

#### B10 · `addDocument` up to 6 sequential DB writes, no transaction
- **File:** `store/app-store.ts` ~L692-819
- **Evidence:** `getTotalFileCount` → `createDocument` → `updateDocumentOcrText` → `updateDocumentNotificationId` → `loadDocuments`. Crash mid-way = partial state.
- **Fix:** Wrap create + updates in a single transaction.

#### B11 · `updateDocumentOcrText` bumps `updated_at` → fires FTS trigger
- **File:** `db/documents.ts` ~L76-84
- **Evidence:** `SET updated_at = datetime('now')` on OCR text save triggers `documents_fts_au` (DELETE + INSERT on FTS). Also changes sort order.
- **Fix:** Remove `updated_at` bump from OCR-only updates.

#### B12 · `sortDocumentsBy` creates 3 intermediate arrays + N Date parses
- **File:** `store/app-store.ts` ~L916-939
- **Evidence:** `docs.map(d => ({d, ms: new Date(d.updated_at).getTime()}))` → sort → `.map(s => s.d)`. 200 docs = 200 Date constructions.
- **Fix:** Pre-cache numeric timestamp (`updatedAtMs`) on documents; single `[...docs].sort(...)`.

#### B13 · `setSortBy` double `set()` = double re-render
- **File:** `store/app-store.ts` ~L291-295
- **Evidence:** `set({ sortBy })` then `set({ documents: sortDocumentsBy(...) })`.
- **Fix:** Single `set({ sortBy, documents: ... })`.

#### B14 · `duplicateDocument` 7-8 sequential queries, no transaction
- **File:** `store/app-store.ts` ~L873-895
- **Evidence:** `getDocumentById` → file copy → `addDocument` (internally 4-5 queries) → `getTagsForDocument` → `addTagsToDocument` → `loadDocuments`.
- **Fix:** Wrap DB portion in a transaction. Copy tags with single `INSERT INTO ... SELECT FROM`.

#### B15 · Sequential file stats in `preflightBackup`
- **File:** `services/BackupService.ts` ~L199-206
- **Evidence:** 5,000 sequential `getInfoAsync` calls (1-2 ms each) = 5-10 s preflight.
- **Fix:** Batch with `Promise.all` in chunks of 20-50.

#### B16 · Sequential file stats in `preflightShareSelectedDocuments`
- **File:** `services/BackupService.ts` ~L223-229
- **Evidence:** Same sequential pattern.
- **Fix:** Same batched approach.

#### B17 · Sequential file extraction during restore
- **File:** `services/BackupService.ts` ~L486-492
- **Evidence:** Each file extracted to base64 and written one at a time.
- **Fix:** Batch writes in groups of 8-12. Add `onProgress` to restore.

#### B18 · Sequential file moves during restore swap
- **File:** `services/BackupService.ts` ~L500-508
- **Evidence:** Two loops: existing → rollback, staged → live. Each `moveFileOrCopy` = 1-3 native calls. 2,000 files = 6,000-12,000 sequential calls.
- **Fix:** Rename *directories* instead of moving individual files (2 renames vs thousands).

#### B19 · Multiple base64 copies during PDF merge
- **File:** `services/PdfService.ts` ~L124-138
- **Evidence:** Each chunk read as base64, parsed into `PDFDocument`, merged. `sourcePdf` + `chunkBase64` linger until GC.
- **Fix:** Null-out after each iteration. Delete chunk files immediately after merging.

#### B20 · No retry logic for Google Drive resumable uploads
- **File:** `services/GoogleDriveSync.ts` ~L434-457
- **Evidence:** Single PUT; transient failure discards entire upload.
- **Fix:** Retry with exponential backoff (2-3 attempts). Query upload status for resume offset.

#### B21 · Sequential bulk Drive upload, no dedup
- **File:** `services/GoogleDriveSync.ts` ~L521-539
- **Evidence:** 500 documents → 500 sequential uploads, no check for already-existing files.
- **Fix:** Pre-query Drive folder; upload 2-3 in parallel with semaphore.

#### B22 · Office file preview loads full base64 into memory
- **File:** `services/offlinePreview.ts` ~L312-335
- **Evidence:** 20 MiB file → ~27 MiB base64 + JSZip parse. Peak 50-80 MiB per preview.
- **Fix:** Reduce cap to 10 MiB; null-out base64 after parse; or extract only needed XML parts.

#### B23 · No `babel.config.js` — reanimated plugin missing
- **File:** (missing)
- **Evidence:** No explicit Babel config. `react-native-reanimated/plugin` required for worklet transforms.
- **Fix:** Create `babel.config.js` with `presets: ['babel-preset-expo']` + `plugins: ['react-native-reanimated/plugin']`.

---

### C) MEDIUM

#### C1 · `getOrCreateTagByName` race between SELECT and INSERT
- **File:** `db/tags.ts` ~L116-126
- **Fix:** `INSERT OR IGNORE` + `SELECT`.

#### C2 · `loadSettings` up to 6 sequential DB calls
- **File:** `store/app-store.ts` ~L314-432
- **Fix:** Fold `proBillingEntitled`/`isPro` keys into batched `getSettings`.

#### C3 · Missing index on `documents.expiry_date`
- **File:** `db/schema.ts`
- **Evidence:** `getDocumentsExpiringSoon` filters + sorts by `expiry_date` with full table scan.
- **Fix:** `CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON documents(expiry_date)`.

#### C4 · `updateTag` redundant uniqueness check
- **File:** `db/tags.ts` ~L32-44
- **Evidence:** Manual SELECT before UPDATE; UNIQUE constraint already handles it.
- **Fix:** Just UPDATE, catch constraint error.

#### C5 · Unbounded parameter count in batch tag INSERTs
- **File:** `db/tags.ts` ~L70-95
- **Evidence:** SQLite limit ~999 vars. >499 items breaks.
- **Fix:** Chunk into batches of ~400.

#### C6 · `searchDocuments` LIKE fallback: correlated subquery per row
- **File:** `db/documents.ts` ~L156-168
- **Fix:** CTE for matching tag IDs, then UNION.

#### C7 · `openDrawer` callback not memoized
- **File:** `app/(drawer)/index.tsx` ~L160-162
- **Fix:** `useCallback`.

#### C8 · `handleClearSelection` / `handleSelectAll` not memoized
- **File:** `app/(drawer)/index.tsx` ~L179-187
- **Fix:** `useCallback`.

#### C9 · `selectedCategory` / `selectedTag` computed via `.find()` every render
- **File:** `app/(drawer)/index.tsx` ~L136-137
- **Fix:** `useMemo`.

#### C10 · `selectedCategory` not memoized in `DocumentEditorScreen`
- **File:** `app/document/[id].tsx` ~L644
- **Fix:** `useMemo`.

#### C11 · `renderOcrHighlightedBody` not memoized, creates inline styles
- **File:** `app/document/[id].tsx` ~L468-486
- **Evidence:** `splitOcrTextForHighlight` runs every render; inline `{ fontSize, lineHeight }` recreated.
- **Fix:** `useCallback` + memoize base style.

#### C12 · `getOcrPageQuality` called 3× for same page
- **File:** `app/document/[id].tsx` ~L1208-1261
- **Fix:** Compute once into a local variable.

#### C13 · Inline style objects in `DocumentEditorScreen` and `HomeScreen`
- **Files:** `app/document/[id].tsx` ~L665, `app/(drawer)/index.tsx` ~L433
- **Fix:** Move to `StyleSheet.create`.

#### C14 · `CustomDrawerContent` — `renderCategory` not `useCallback`
- **File:** `components/layout/CustomDrawerContent.tsx` ~L153-190
- **Fix:** Wrap with `useCallback`.

#### C15 · `Toast` — `onDone` in effect deps may restart animation
- **File:** `components/ui/Toast.tsx` ~L33
- **Fix:** Use ref for `onDone`.

#### C16 · `BackupProgressModal` — 1 s tick while visible
- **File:** `components/ui/BackupProgressModal.tsx` ~L30-34
- **Evidence:** `setInterval` + `setTick` every second. Guard prevents running when hidden.
- **Fix:** Acceptable as-is; consider ref-based force-update if more content added.

#### C17 · Picked zip not cleaned from cache after restore
- **File:** `services/BackupService.ts` ~L394-403
- **Evidence:** `copyToCacheDirectory: true` leaves orphaned zip.
- **Fix:** `deleteAsync(zipUri)` in `finally`.

#### C18 · Redundant permission check in `scheduleExpiryNotification`
- **File:** `services/NotificationService.ts` ~L92-98
- **Evidence:** `getPermissionsAsync` then `requestPermissionsAsync`. Second call handles both.
- **Fix:** Single `requestPermissionsAsync`.

#### C19 · Read-modify-write per metric sample
- **Files:** `services/ocrMetrics.ts` ~L55-84, `services/performanceMetrics.ts` ~L50-74
- **Evidence:** Full SQLite read-parse-mutate-serialize-write per OCR page.
- **Fix:** Accumulate in memory; flush periodically (every 5 s or on background).

#### C20 · Sequential image reads in `createPdfChunk`
- **File:** `services/PdfService.ts` ~L66-95
- **Fix:** Pre-read 3-4 in parallel with `Promise.all`.

#### C21 · HTML template embeds full base64 image as data URI
- **File:** `services/PdfService.ts` ~L328-341
- **Evidence:** 5 MB photo → ~6.7 MB base64 embedded in HTML string. WebView holds copy too.
- **Fix:** Write to temp file, reference via `file://` URI.

#### C22 · Token refresh not retried on transient failure
- **File:** `services/GoogleDriveSync.ts` ~L307-321
- **Fix:** Retry once after 1 s delay.

#### C23 · `driveDocumentUploadQueue` unbounded promise chain
- **File:** `services/GoogleDriveSync.ts` ~L13, ~L599-616
- **Fix:** Array-based async queue with `processNext` runner.

#### C24 · Sync ops declared async in `StorageService`
- **File:** `services/StorageService.ts` ~L35-55
- **Evidence:** `expo-file-system` new API is synchronous; `async` adds microtask overhead. No-op `try/catch/throw`.
- **Fix:** Remove `async` or document intent; remove pointless re-throw.

#### C25 · `expo-symbols` pulled in only by dead template code
- **File:** `components/ui/icon-symbol.tsx`
- **Fix:** Remove with template cleanup (see C30).

#### C26 · `@react-navigation/elements` imported only by dead `haptic-tab.tsx`
- **File:** `components/haptic-tab.tsx`
- **Fix:** Remove file.

#### C27 · `expo-application` undeclared dependency
- **File:** `config/googleDrive.ts`
- **Evidence:** Used but not in `package.json`; works via transitive dep. Fragile.
- **Fix:** Add to `dependencies` explicitly.

#### C28 · JSZip (~45 KB) loaded eagerly at startup
- **Files:** `services/offlinePreview.ts`, `services/BackupService.ts`
- **Fix:** Dynamic `import('jszip')` on first use.

#### C29 · `pdf-lib` (~200 KB) loaded eagerly at startup
- **File:** `services/PdfService.ts`
- **Fix:** Dynamic `import('pdf-lib')` on first use.

#### C30 · Dual theme systems + 10+ dead template files
- **Files:** `constants/theme.ts`, `hooks/use-theme-color.ts`, `hooks/use-color-scheme.ts`, `hooks/use-color-scheme.web.ts`, `components/themed-text.tsx`, `components/themed-view.tsx`, `components/parallax-scroll-view.tsx`, `components/ui/collapsible.tsx`, `components/ui/icon-symbol.tsx`, `components/ui/icon-symbol.ios.tsx`, `components/haptic-tab.tsx`, `components/external-link.tsx`
- **Evidence:** None of these are imported by actual app screens. `constants/theme.ts` has light/dark system conflicting with hardcoded `"userInterfaceStyle": "dark"`.
- **Fix:** Delete all template leftovers.

#### C31 · OAuth client ID duplicated in 3 places
- **Files:** `app.json`, `plugins/withAndroidGoogleDriveOAuthIntent.js`
- **Fix:** Single source constant.

#### C32 · `eas.json` missing explicit Android production config
- **Fix:** Add `"android": { "buildType": "app-bundle" }` and `resourceClass` for clarity.

#### C33 · `@types/jszip` possibly redundant
- **File:** `package.json`
- **Fix:** Check if removing causes TS errors; remove if not needed.

---

### D) LOW

#### D1 · `await getDb()` microtask overhead on every DB call
- **Files:** All `db/*.ts`
- **Evidence:** After first call the singleton is cached, but `await` creates a microtask tick per call (~0.01 ms).
- **Fix:** No action needed (idiomatic).

#### D2 · `DOCUMENT_LIST_SELECT_D` string computation at module load
- **File:** `db/documents.ts` ~L9-11
- **Fix:** None needed (runs once).

#### D3 · `selectAll` builds new array of all document IDs
- **File:** `store/app-store.ts` ~L303-306
- **Fix:** Consider `Set<number>` for `selectedIds`.

#### D4 · FTS rebuild check: 2 sequential COUNT queries on cold start
- **File:** `db/schema.ts` ~L111-123
- **Fix:** Single scalar subquery: `SELECT (SELECT COUNT(*) FROM documents) AS dc, (SELECT COUNT(*) FROM documents_fts) AS fc`.

#### D5 · `EmptyState` JSX recreated every render
- **File:** `app/(drawer)/index.tsx` ~L521
- **Fix:** `useMemo` or render function.

#### D6 · `CategoryPicker` in editor not memoized
- **File:** `app/document/[id].tsx` ~L1496-1554
- **Fix:** `React.memo` (low priority — inside modal).

#### D7 · Animation queuing on rapid taps in `DocumentCard`
- **File:** `components/document/DocumentCard.tsx` ~L128-131
- **Fix:** `scaleAnim.stopAnimation()` before new sequence.

#### D8 · `handleBulkDelete` / `handleBulkMove` sequential await in loops
- **File:** `app/(drawer)/index.tsx` ~L194-224
- **Fix:** `Promise.all` with batched concurrency (or progress indicator).

#### D9 · `ImportReviewScreen` utility functions defined inside component
- **File:** `app/document/import-review.tsx` ~L128-143
- **Fix:** Move to module scope.

#### D10 · `PaywallModal` individual selectors without `useShallow`
- **File:** `components/ui/PaywallModal.tsx` ~L79-80
- **Fix:** Consolidate (consistency).

#### D11 · `_layout.tsx` stable actions in effect deps
- **File:** `app/_layout.tsx` ~L55-65
- **Fix:** `[]` deps (Zustand actions are referentially stable).

#### D12 · No filename collision guard in `saveFileToArchive`
- **File:** `services/StorageService.ts` ~L39-44
- **Evidence:** `Date.now()` has ms resolution; rapid saves can collide.
- **Fix:** Append random suffix.

#### D13 · Dynamic `import('expo-notifications')` not cached
- **File:** `services/NotificationService.ts` ~L11-17
- **Fix:** Cache module reference after first import.

#### D14 · P50 full sort on every metric write
- **Files:** `services/ocrMetrics.ts`, `services/performanceMetrics.ts`
- **Fix:** Compute only on flush; or sorted insertion.

#### D15 · `WEEK_MS` constant recomputed per call in `limits.ts`
- **File:** `services/limits.ts` ~L18
- **Fix:** Hoist to module scope.

#### D16 · Drive folder verification on every upload
- **File:** `services/GoogleDriveSync.ts` ~L245-251
- **Fix:** In-memory cache with 5 min TTL.

#### D17 · Empty `catch {}` silently swallows errors in PDF embed
- **File:** `services/PdfService.ts` ~L94
- **Fix:** Log in `__DEV__`; collect failed URIs for UI warning.

#### D18 · Unused `expo-font` dependency
- **File:** `package.json`
- **Fix:** Remove.

#### D19 · Unused `expo-system-ui` dependency
- **File:** `package.json`
- **Fix:** Remove.

#### D20 · Unused `expo-intent-launcher` dependency
- **File:** `package.json`
- **Fix:** Remove.

#### D21 · `react-native-web` + `react-dom` likely unnecessary for native-only app
- **File:** `package.json`
- **Fix:** Move to `devDependencies` or remove.

#### D22 · Stray `grep goog_` file in project root
- **File:** root
- **Fix:** Delete.

---

## Part 3 — Priority Matrix

### Tier 1 — Highest ROI (fix first)

| ID | Area | Issue | Est. Impact |
|----|------|-------|-------------|
| A1 | Frontend | `DocumentCard` React.memo | **Major** — eliminates N card re-renders per state change |
| A2 | Frontend | Lift Zustand subscription out of card | **Major** — eliminates N subscriptions |
| A3 | Frontend | FlatList perf props | **Major** — removes layout thrash, reduces mounted cards |
| B1 | Frontend | Stable callbacks in `renderDocument` | **Major** — enables memo on card |
| B2 | Frontend | Stable empty-tags constant | **Major** — completes memo chain |
| A4 | Memory | Streaming / native zip for backup | **Critical** — prevents OOM crash |
| A5 | Memory | Native unzip for restore | **Critical** — prevents OOM crash |

### Tier 2 — High value, moderate effort

| ID | Area | Issue | Est. Impact |
|----|------|-------|-------------|
| A6-A9 | Bundle | Remove 4 unused deps (~600 KB+) | **High** — smaller APK, faster cold start |
| B3 | Frontend | Capture screen `useShallow` consolidation | **High** — 20 subscriptions → 1 |
| B7 | Frontend | Settings sub-components | **High** — isolates re-renders |
| B8 | Store | `removeCategory` parallel reload | **High** — halves latency |
| B10 | DB | `addDocument` transaction | **High** — atomicity + fewer round-trips |
| B13 | Store | `setSortBy` single `set()` | **High** — eliminates double re-render |
| B15-B18 | I/O | Batch file stats + extraction in backup/restore | **High** — order-of-magnitude faster |
| B23 | Build | Add `babel.config.js` with reanimated plugin | **High** — correctness fix |
| C30 | Bundle | Delete dead template files | **Medium** — cleaner codebase, smaller bundle |

### Tier 3 — Medium value, quick wins

| ID | Area | Issue | Est. Impact |
|----|------|-------|-------------|
| B5-B6 | Frontend | Merge OCR effects in editor | **Medium** — 2-3 fewer render passes |
| B11 | DB | Remove `updated_at` bump from OCR update | **Medium** — avoids FTS trigger + sort disruption |
| B12 | Store | Cache timestamps in `sortDocumentsBy` | **Medium** — fewer allocations |
| C3 | DB | Index on `expiry_date` | **Medium** — faster expiry queries |
| C7-C9 | Frontend | `useCallback` / `useMemo` on home screen | **Medium** — reference stability |
| C17 | Disk | Clean picked zip after restore | **Medium** — avoids cache growth |
| C28-C29 | Bundle | Lazy-load JSZip + pdf-lib | **Medium** — ~245 KB deferred from startup |

### Tier 4 — Low value / long tail

Everything in section **D** (D1-D22). Fix opportunistically during related work.

---

## Part 4 — Bundle Size Audit

| Package | Status | Size (approx.) | Action |
|---------|--------|-----------------|--------|
| `mammoth` | Unused | ~400 KB | **Remove** |
| `cfb` | Unused | ~80 KB | **Remove** |
| `deprecated-react-native-prop-types` | Unused | ~50 KB | **Remove** |
| `react-native-worklets` | Unused (native) | ~200 KB native | **Remove** |
| `expo-font` | Unused | ~30 KB | **Remove** |
| `expo-system-ui` | Unused | ~20 KB | **Remove** |
| `expo-intent-launcher` | Unused | ~15 KB | **Remove** |
| `react-native-web` | Unused (native-only) | ~150 KB | **Move to devDeps** |
| `react-dom` | Unused (native-only) | ~130 KB | **Move to devDeps** |
| `jszip` | Used, eager load | ~45 KB | **Lazy import** |
| `pdf-lib` | Used, eager load | ~200 KB | **Lazy import** |
| `@types/jszip` | Possibly redundant | dev only | **Verify + remove** |
| **Total recoverable** | | **~1.1 MB JS + ~200 KB native** | |

---

## Part 5 — Dead Code Inventory

Files safe to delete (zero app-screen imports):

| File | Origin |
|------|--------|
| `constants/theme.ts` | Expo template |
| `hooks/use-theme-color.ts` | Expo template |
| `hooks/use-color-scheme.ts` | Expo template |
| `hooks/use-color-scheme.web.ts` | Expo template |
| `components/themed-text.tsx` | Expo template |
| `components/themed-view.tsx` | Expo template |
| `components/parallax-scroll-view.tsx` | Expo template |
| `components/ui/collapsible.tsx` | Expo template |
| `components/ui/icon-symbol.tsx` | Expo template |
| `components/ui/icon-symbol.ios.tsx` | Expo template |
| `components/haptic-tab.tsx` | Expo template |
| `components/external-link.tsx` | Expo template |
| `grep goog_` (root) | Accidental file |

---

## Part 6 — Verification Checklist

| Check | Method |
|-------|--------|
| Home list scroll jank | Profile with Flipper / Systrace on low-end Android after A1-A3, B1-B2 |
| Backup OOM | Create backup near 100 MiB cap; monitor `adb shell dumpsys meminfo <pid>` |
| Restore latency | Time restore of 2,000-file zip before/after B17-B18 |
| Bundle size | Compare `npx expo export --platform android` output before/after dependency removal |
| Cold start time | Measure with `adb shell am start -W` before/after lazy imports (C28-C29) |
| Sort re-render | Toggle sort order; verify no tag refetch (§11) and single set() (B13) |
| Bulk tag | Tag 50+ docs; verify single INSERT (§10) |
| FTS trigger | Update OCR text; verify no `updated_at` bump after B11 |
| Dead code removal | Run `npx expo lint` after removing template files; confirm 0 import errors |

---

## Notes

- This report is **analysis only** — no code was changed in this pass.
- Findings are cumulative with the §1-§13 implemented fixes listed in Part 1.
- Severity reflects **impact × likelihood** for this specific app's usage patterns (single-user vault, ~50-500 documents typical, up to 5,000 at cap).
- "Critical" for memory items reflects device crash risk, not frequency.
