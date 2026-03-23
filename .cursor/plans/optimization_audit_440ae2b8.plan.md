---
name: Optimization Audit
overview: Create `OPTIMIZATIONS.md` with a full, evidence-based optimization audit (performance, scalability, reliability, cost, and security-impacting inefficiencies) across DB/search/UI rendering and heavy flows (OCR/PDF/backup/AI). Include a prioritized finding list, quick wins, deeper refactors, validation steps, and proposed (non-applied) patch snippets where feasible.
todos:
  - id: write-optimizations-md
    content: Create `OPTIMIZATIONS.md` at repo root and populate it with the required output format and prioritized findings, citing evidence from the files listed above.
    status: completed
  - id: add-proposed-patches
    content: In `OPTIMIZATIONS.md`, include patch-ready snippets (debounce, FlatList virtualization, index/FTS SQL, and safe backup/PDF concurrency/limits) without applying them to the codebase.
    status: completed
  - id: validation-plan
    content: "Add a concrete validation plan: measurable before/after metrics for DB query latency, UI render times, memory peaks during backup/restore/PDF, and OCR polling behavior; list manual test cases for correctness."
    status: completed
isProject: false
---

## Deliverable

- Create or update `[OPTIMIZATIONS.md](OPTIMIZATIONS.md)` at the repo root.

## Approach

- Use the already-read implementation to build findings with concrete evidence (function/query/render paths).
- Prioritize by expected ROI and risk of regressions.
- Provide “patch-ready” code suggestions as snippets, but do not apply code changes unless you later ask.

## Evidence we will cite in `OPTIMIZATIONS.md`

- DB search query: `[db/documents.ts](db/documents.ts)` `searchDocuments()` uses tag joins + `%LIKE%` + optional `ocr_text LIKE` and `ORDER BY updated_at DESC`.
- Keystroke search behavior: `[components/layout/CustomDrawerContent.tsx](components/layout/CustomDrawerContent.tsx)` calls `runSearch(q)` and `router.replace('/(drawer)')` directly in `handleSearch` (with `[components/ui/SearchInput.tsx](components/ui/SearchInput.tsx)` being a thin wrapper, no debounce).
- Sorting duplication: `[store/app-store.ts](store/app-store.ts)` `runSearch()` calls `searchDocuments()` (already ordered by `updated_at DESC`) and then re-sorts in JS via `sortDocumentsBy`.
- Missing indexes: `[db/schema.ts](db/schema.ts)` defines tables and WAL/foreign keys, but no indexes for `documents.updated_at`, `documents.category_id`, `document_tags.tag_id/document_id`, `tags.name`, and no FTS.
- Prompt template list rendering: `[components/ui/PromptTemplateSheet.tsx](components/ui/PromptTemplateSheet.tsx)` uses `ScrollView` + `templates.map(...)` which mounts all prompt cards.
- Backup/PDF heavy I/O and memory: `[services/BackupService.ts](services/BackupService.ts)` reads archive files to Base64 sequentially and builds JSZip entirely in memory (plus restore uses `Promise.all` for writes).
- PDF heavy Base64 embedding: `[services/PdfService.ts](services/PdfService.ts)` reads entire image to Base64 and embeds it into HTML for print.
- OCR extraction import overhead: `[services/ocrExtract.ts](services/ocrExtract.ts)` dynamically imports the OCR module per call.
- OCR polling load: `[app/document/[id].tsx](app/document/[id].tsx)` polls DB every 2s up to 15 attempts after save.

## Output formatting

- Use your required sections in `OPTIMIZATIONS.md`:
  1. Optimization Summary
  2. Findings (Prioritized) with the specified fields
  3. Quick Wins (Do First)
  4. Deeper Optimizations (Do Next)
  5. Validation Plan (benchmarks/profiling/metrics/tests)
  6. Optimized Code / Patch (when possible: snippets only)

## Prioritized recommendation targets

- Add debounced search and avoid route replacement on every keystroke.
- Add/adjust SQLite indexes (or FTS5) to make `%LIKE%` searches and `ORDER BY updated_at` fast.
- Prevent double-sorting and minimize JS allocations on the hot list path.
- Replace `ScrollView + map` with `FlatList` virtualization in the prompt modal.
- Reduce Base64/JSZip/PDF memory pressure via streaming/limits/concurrency controls.

## Notes

- No code will be modified in this step; the plan only prepares `OPTIMIZATIONS.md`.

