### SECURITY AUDIT: Backup restore hardening + OCR multi-scan + vault lock (PIN-only) + search/store/UI updates

**Risk Assessment:** Secure (given offline, local-threat model)
#### **Findings:**
* **Local File Exfiltration via Malicious Restore (`file_uri` not sanitized)** (Severity: Mitigated -> Low)
* Location: `services/BackupService.ts` (restoreFromBackup manifest->DB mapping)
* The Exploit: Crafted `VaultBackup.zip` could previously inject attacker-controlled `documents[].file_uri` into SQLite, enabling later archive/share steps to read and leak unintended device files.
* The Fix: `restoreFromBackup()` now treats `manifest.json` as untrusted:
  - validates/caps manifest and backup sizes/counts
  - whitelists `file_type`
  - derives restored `documents.file_uri` strictly as `ARCHIVE_DIR + safeBasename`
  - only restores document rows when that basename exists in the zip’s `archive/` entries (prevents arbitrary path usage)
* **Archive entry name sanitization is partial (risk of restore corruption / FS edge cases)** (Severity: Mitigated -> Low)
* Location: `services/BackupService.ts` (archive entry naming + de-dupe)
* The Exploit: Malicious zip entry names could cause restore failures or persistent corruption.
* The Fix: stronger restore-time filename validation, reserved-name rejection, and de-dupe by basename before any write; prevents traversal-like edge cases and overwrites.
* **DoS risk from unbounded backup parsing + base64 extraction** (Severity: Mitigated -> Low)
* Location: `services/BackupService.ts` (`restoreFromBackup()` zip/manifest entry processing)
* The Exploit: Oversized/malicious backups could trigger memory spikes and long blocking restore.
* The Fix: hard caps added for zip size, manifest size, categories/doc counts, archive entry count, and per-entry uncompressed-size handling to bound worst-case memory/time.
* **OCR quota trust boundary can be bypassed via `preOcrText` persistence** (Severity: Mitigated -> Low)
* Location: `store/app-store.ts` (`addDocument()` PDF `preOcrText` handling)
* The Exploit: If `preOcrText` were accepted as “already paid” OCR, it could bypass free-tier limits.
* The Fix: PDF `preOcrText` is now treated as trusted only when it matches the internal `pendingOcrText` draft for the exact `fileUri`/`fileType`; otherwise (Free tier) `addDocument()` enforces quota consumption (or refuses to persist OCR when exhausted).
#### **Observations:**
* **Vault lock (PIN-only):** Biometric / Face ID / fingerprint unlock via `expo-local-authentication` has been **removed** from the app (smaller native auth surface; no OS biometric prompt for vault unlock). Unlock is a **4-digit PIN** checked in-app against the value stored under SQLite `settings` (`pinHash` key — stored as plaintext today, not a cryptographic hash). Threat model: keeps casual access out when the device is already unlocked; it is **not** a substitute for full-disk encryption or a strong device passcode.
* **Re-lock timing:** Vault re-lock is driven by AppState (minimize → resume) with a **minimum time away** and `auth-flags` / `vaultLockPolicy` so that system UI (pickers, share sheets) and short OS transitions are less likely to trigger a false lock. This is a **UX/reliability** control, not an additional crypto layer.
* **Capture / Add flow:** The `capture` route sets `systemPickerOpen` for the entire screen lifetime; individual flows also use `withExternalActivityGuard` where native sheets open. Reduces mistaken “user left the app” signals during scan/import.
* **Debug / telemetry:** Earlier vault-lock debug helpers and NDJSON-style ingest were **removed** from the codebase—no built-in remote vault-lock tracing in production paths (lowers risk of accidental sensitive logging if reintroduced carelessly).
* DB search query changes (`db/documents.ts`): parameterized `LIKE ?` usage prevents SQL injection exposure in these diffs.
* Restore UX/storage hygiene: backup/shares delete generated cached zip files to reduce local residue.
* OCR polling: replaced overlapping `setInterval` pattern with a cancellable `setTimeout` loop.
* OCR rendering: OCR is displayed as plain `Text` nodes; no HTML/JS injection path from OCR content.
