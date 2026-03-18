---
name: AI workflow upgrade
overview: "Upgrade the current “Use AI” prompt sheet into a full AI workflow: prompt library (100 templates) + curated AI destination picker (Android-only) that prefers AI apps and always provides a “More…” fallback share sheet."
todos:
  - id: ai-destination-sheet
    content: Add AI destinations model + destination picker sheet + share fallback
    status: pending
  - id: prompt-library-100
    content: Create 100-template registry and filtering/search/category UI
    status: pending
  - id: wire-use-ai-flow
    content: Update DocumentCard + editor to open prompt library, then destination picker
    status: pending
  - id: privacy-disclaimer
    content: Show disclaimer near share step, add optional dont-show-again setting
    status: pending
  - id: manual-test-notes
    content: Write manual test checklist for prompts + destinations + fallbacks
    status: pending
isProject: false
---

# AI workflow upgrade (Android-only)

## Goals

- Replace the current “Use AI” flow with: **PromptLibrary → copy prompt → AI destination picker → share**.
- On Android, show an **AI-app-only(ish)** list via an in-app destinations picker; always include **More…** for the normal share sheet.
- Build an in-repo library of **100 prompt templates** with categories + search.

## Current state (what we’ll build on)

- `components/ui/PromptTemplateSheet.tsx` already: lists a few templates, copies to clipboard, can open `expo-sharing` share sheet.
- `services/PromptTemplates.ts` already: small registry + simple filtering.
- Entry points already wired from:
  - `components/document/DocumentCard.tsx` (“Use AI”)
  - `app/document/[id].tsx` (sparkles button)

## Part A — AI destinations picker (Android)

### Approach (closest OS allows, without hardcoding share sheet destinations)

Because Expo/React Native cannot reliably enumerate *all installed apps* without a native package-manager query API, we’ll implement:

- **A curated AI destination list** (inside the app) using known Android package names / deep links for common AI apps.
- **A user-extendable list** (“Add AI app”) where the user can enter an Android package name (optional but matches your request: “all AI apps installed should appear” as much as possible).
- **Always provide “More…”** which opens the standard share sheet via `expo-sharing`.

### Implementation

- Add `services/AiDestinations.ts`:
  - `AiDestination` model: `{ id, title, packageName?, deepLinkUrl? }`
  - Default destinations: ChatGPT, Gemini, (optionally Claude/Copilot behind a constant) + More.
  - Helper `canOpenDestination(destination)` uses `Linking.canOpenURL` for deep links (best-effort).
- Add `components/ui/AiDestinationSheet.tsx`:
  - Bottom sheet UI matching existing sheet style.
  - Shows a list of destination cards + “More…”.
  - Behavior:
    - If destination deep link is supported: open deep link (best-effort), then still present “Share document” as the reliable send step.
    - If not supported: show toast “App not installed. Opening share sheet.” and open share sheet.
    - “More…” always opens share sheet.
- Add optional persistence for custom destinations in SQLite settings:
  - `db/settings.ts` already exists; store JSON array under key like `aiDestinationsCustom`.

## Part B — Prompt library (100 templates)

### Data

- Create `data/promptTemplates.ts`:
  - Export `PromptTemplate[]` with 100 entries.
  - Fields: `id`, `title`, `description`, `category`, `supportedTypes`, `prompt` with `{docTitle}`, `{docType}`, `{categoryName}`.
  - Categories:
    - Receipts_Expenses
    - Warranties_Returns
    - Contracts_Legal
    - IDs_PersonalDocs
    - Business_Invoices
    - Education
    - Medical
    - Vehicles_Insurance
    - RealEstate_Home
    - General
- Update `services/PromptTemplates.ts` to:
  - Import from `data/promptTemplates.ts`.
  - Expand category normalization so Vault category names map to the above set.
  - Add search helper: `filterTemplates({ query, category, fileType, vaultCategoryName })` returning “relevant first” ordering.

### UI

- Replace `components/ui/PromptTemplateSheet.tsx` with `components/ui/PromptLibrarySheet.tsx` (or extend existing component) adding:
  - Search input (reuse `components/ui/SearchInput`).
  - Category chips/tabs row.
  - Prompt cards list.
  - Actions per prompt:
    - “Copy prompt”
    - “Copy + Continue to AI” (copies then opens destination sheet)
  - After copy: `useAppStore().showToast('Prompt copied. Choose an AI app.', 'success')`.

## Part C — Integration flow

- Introduce a small coordinator component (or local state) to chain:
  - PromptLibrarySheet → AiDestinationSheet
- Update entry points:
  - `components/document/DocumentCard.tsx`
  - `app/document/[id].tsx`
  so tapping “Use AI” always opens **PromptLibrarySheet**.

## Part D — Privacy disclaimer

- Keep the disclaimer text near the share step (in destination sheet):
  - “Sharing sends a copy to another app/service. Their privacy rules apply.”
- Optional “Don’t show again” stored via `db/settings.ts` (key like `aiSharePrivacyDismissed`).

## Files to change / add

- Add:
  - `data/promptTemplates.ts`
  - `services/AiDestinations.ts`
  - `components/ui/AiDestinationSheet.tsx`
  - (Optional) `components/ui/PromptLibrarySheet.tsx` (or evolve `PromptTemplateSheet.tsx`)
- Update:
  - `services/PromptTemplates.ts` (use 100 prompts + filtering)
  - `components/ui/index.ts` (export new sheets)
  - `components/document/DocumentCard.tsx` (new flow)
  - `app/document/[id].tsx` (new flow)

## Manual test plan

- Open document → Use AI → search template → Copy + Continue → toast shows → AI destination sheet shows → select destination → if not installed → fallback to share sheet → if installed → (optional deep link) then share sheet.
- Verify placeholder rendering uses current doc title/type/category.
- Verify category tabs + filtering works across file types.
- Verify “More…” always opens share sheet.
- Verify disclaimer visible near share step and “Don’t show again” persists (if enabled).

