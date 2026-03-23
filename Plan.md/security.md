### ### SECURITY AUDIT: Backup restore hardening + OCR multi-scan + search/store/UI updates
**Risk Assessment:** Secure
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
* DB search query changes (`db/documents.ts`): parameterized `LIKE ?` usage prevents SQL injection exposure in these diffs.
* Restore UX/storage hygiene: backup/shares delete generated cached zip files to reduce local residue.
* OCR polling: replaced overlapping `setInterval` pattern with a cancellable `setTimeout` loop.
* OCR rendering: OCR is displayed as plain `Text` nodes; no HTML/JS injection path from OCR content.
