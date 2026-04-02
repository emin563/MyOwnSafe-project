### SECURITY AUDIT: Vault - Document Archive (Post-Remediation)
**Date:** 2026-03-23
**Risk Assessment:** Low-Medium
**Security Score: 78 / 100**

---

## Scoring Breakdown

| Category | Weight | Score | Notes |
|---|---|---|---|
| Authentication & Lock Screen | 25% | 90/100 | PIN/biometric removed; delegated to OS-level app lock (Samsung Secure Folder, Android Private Space, iOS Screen Time). No in-app secret storage. |
| Data at Rest | 20% | 55/100 | SQLite still unencrypted (acceptable for local-only, offline-first vault). No secrets or API keys stored. |
| File System & Storage | 15% | 85/100 | `sanitizeFilename` enforced on all imports, `isInsideArchive` guard on delete, `ARCHIVE_DIR` prefix checked on share/export reads. |
| Backup / Restore | 10% | 90/100 | Transaction-wrapped restore, manifest validation, path traversal blocked, size caps, de-duplication, `document_tags` cleaned on restore. |
| Paywall / Business Logic | 15% | 80/100 | `setIsPro` gated behind `__DEV__`, redundant `setIsPro` removed from all PaywallModal callbacks, `syncProStatus` is bidirectional (revokes on refund), `purchasePro`/`restorePro` are the sole production paths. |
| Dependencies & Config | 10% | 70/100 | `RECORD_AUDIO` permission removed. Remaining: review `xlsx` dependency for CVEs, audit `expo-text-extractor` version. |
| OCR / AI Workflow | 5% | 80/100 | Trust boundary for `preOcrText`, TOCTOU guarded with reentrancy lock, quota consumption is atomic. |

**Weighted Score: 78/100**

---

## Changes Made (This Session)

### PIN / Biometric / Lock Screen — Complete Removal

| What | Action |
|---|---|
| `components/security/LockScreen.tsx` | **Deleted** |
| `services/vaultLockPolicy.ts` | **Deleted** |
| `store/auth-flags.ts` | Stripped vault-lock-related exports (`MIN_MINIMIZED_MS_FOR_VAULT_LOCK`, `POST_VAULT_INTERACTION_ARM_IGNORE_MS`, `beginVaultPostInteractionGrace`, `shouldIgnoreVaultMinimizeArm`). Kept only `systemPickerOpen` + `withExternalActivityGuard`. |
| `app/_layout.tsx` | Removed `LockScreen` overlay, `vaultMinimizedAt` ref, `showLock` logic, `applyVaultLockOnMinimizeResume` AppState handler, all PIN/lock state destructures. |
| `store/app-store.ts` | Removed `isUnlocked`, `pinEnabled`, `pinHash` from type + state + initial values. Removed `setUnlocked`, `setPinEnabled`, `verifyPin`. Removed PIN-related lines from `loadSettings`. |
| All consumers | Verified zero remaining references to PIN/lock/biometric across all `.ts`/`.tsx` files. |

### Critical & High Fixes

| ID | Fix |
|---|---|
| C3 | `setIsPro` now guarded by `if (!__DEV__) return;`. All `setIsPro(true)` calls removed from `PaywallModal`/`LimitReachedDialog`/`ProFeatureDialog`/`ProIncludedFeatureDialog` callbacks across `settings.tsx`, `index.tsx`, `capture.tsx`, `document/[id].tsx`, `import-review.tsx`, `CustomDrawerContent.tsx`, `PromptTemplateSheet.tsx`. |
| C4 | `syncProStatus` now bidirectional — writes `isPro: false` when entitlement is revoked. `loadSettings` entitlement check also revokes on mismatch. |
| C5 | Added `escapeHtml()` to `PdfService.ts`. All interpolated fields (`title`, `purchase_price`, `expiry_date`, `categoryName`, `notes`) are escaped before embedding in the HTML template. |
| H2 | Added `sanitizeFilename()` to `StorageService.ts` — strips path separators, control chars, double dots, clamps to 120 chars. Applied to all file saves. |
| H3+H5 | Added `isInsideArchive()` guard to `deleteFileFromArchive()`. Added `ARCHIVE_DIR` prefix check to `exportDocumentAsPdf()` and `shareSelectedDocuments()`. |
| H6 | `resetOcrReadTrialsForDev` now guarded by `if (!__DEV__) return;`. |
| H8 | `restoreFromBackup()` now wraps all SQLite operations in `db.withTransactionAsync()`. Also cleans `document_tags` table on restore. |

### Medium Fixes

| ID | Fix |
|---|---|
| M5 | `searchDocuments()` now escapes `%`, `_`, `\` in LIKE patterns and uses `ESCAPE '\\'` clause. |
| M6 | `shareSelectedDocuments()` validates `doc.file_uri.startsWith(ARCHIVE_DIR)` before reading files. `exportDocumentAsPdf()` validates archive prefix before reading images. |
| M7 | Added `_ocrTrialLock` reentrancy guard to `consumeOcrReadTrial()` to prevent TOCTOU race between concurrent callers. |

### Low Fixes

| ID | Fix |
|---|---|
| L1 | `exportDocumentAsPdf()` now cleans up the temp PDF file in a `finally` block. |
| L5 | Removed `android.permission.RECORD_AUDIO` from `app.json` permissions. |
| L6 | `createDocument()` and `updateDocument()` now enforce `title.slice(0, 500)`, `notes.slice(0, 50_000)`, and validate `expiry_date` format. |

---

## Remaining Items (Acceptable Risk)

| Item | Risk | Rationale |
|---|---|---|
| Unencrypted SQLite | Medium | Standard for local-only mobile apps. OS sandboxing + app lock delegation mitigates. Full DB encryption (SQLCipher) would add ~2 MB and complexity. |
| `xlsx` dependency CVE | Low | Only used for local export; no remote input. Monitor for updates. |
| No server-side receipt validation | Low | RevenueCat handles server-side validation. Local-only fallback is acceptable for offline-first design. |
| OCR text not encrypted | Low | OCR text is user-generated from their own documents. No PII beyond what's already in the document images. |

---

## What's Done Well

- **Parameterized queries everywhere** — zero raw SQL string concatenation.
- **FTS5 search** with safe token sanitization (`buildFtsMatchExpr` strips dangerous chars).
- **Backup hardening** — manifest size caps, per-file size limits, filename sanitization, archive entry limits, de-duplication.
- **OS-delegated security model** — app instructs users to use OS-level app lock features rather than implementing a weaker in-app alternative.
- **External activity guard** — `withExternalActivityGuard` prevents state corruption during native picker/share flows.
- **RevenueCat integration** — production purchase/restore flows go through RevenueCat SDK, not local state manipulation.
