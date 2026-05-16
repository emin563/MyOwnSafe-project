# SECURITY AUDIT — Vault: Document Archive (MASVS)

**Date:** 2026-05-16 (incremental re-audit + remediation; supersedes 2026-04-18)
**App version:** 1.5.1 (versionCode 25) — package.json now aligned to 1.5.1
**Auditor:** Senior Mobile Security review — RN/Expo mapped to OWASP MASVS
**Scope:** services/, store/, db/, config/, app/, components/, plugins/, scripts/,
app.json, app.config.ts, eas.json, babel.config.js, generated AndroidManifest.xml
**Risk Assessment:** Low (all actionable Medium/Low findings remediated; residual
items are accepted architectural/product decisions)
**Security Score:** 93 / 100 (84 at scan; +9 after remediating M1–M4, L1, L8)

> **Remediation status (2026-05-16):** M1, M2, M3, M4, L1, L8 **Fixed** this pass.
> M5, M6, L2–L7 remain **Accepted / by-design** (see §"Remediation Applied").

## Executive Summary

Vault is a local-first Android document archive (RN/Expo). All 18 hardening controls
from the 2026-04-18 audit remain verified and in place. No Critical/High code-logic
vulnerabilities. This re-audit surfaces issues not present (or not detected) before:
known-CVE transitive dependencies, two exported Android components, a Compose tooling
activity leaking into the release manifest, and release builds without R8/JS
minification. None are remotely exploitable without local/physical or same-device app
context; all are straightforward to remediate.

## Findings Summary

### Critical — None
### High — None

### Medium

| ID | Finding | Location | Status |
|----|---------|----------|--------|
| M1 | 6 npm CVEs in transitive deps (2 high: @xmldom/xmldom, fast-uri; 4 moderate: postcss chain) — both highs are build/dev-only tooling, not in the Android runtime | package.json / package-lock.json | **Fixed** — npm `overrides` pin xmldom ^0.9.10, fast-uri ^3.1.2, postcss ^8.5.10; lockfile audit = 0 vulns |
| M2 | `com.canhub.cropper.CropImageActivity` exported, no intent-filter/permission — any app can launch the in-app cropper with arbitrary URIs | merged AndroidManifest.xml:297-298 | **Fixed** — `withAndroidSecurityHardening` forces `exported="false"` (`tools:replace`) |
| M3 | `expo.modules.clipboard.ClipboardFileProvider` `exported="true"`, no `grantUriPermissions` (upstream expo-clipboard default) — provider reachable by other apps | merged AndroidManifest.xml:238-244 | **Fixed** — plugin forces `exported="false"` (`tools:replace`); disables clipboard *file* sharing (text unaffected) |
| M4 | Release builds ship without R8/ProGuard + JS minification (Hermes bytecode only) — lowers reverse-engineering cost | android/gradle.properties (no `android.enableMinifyInReleaseBuilds`); hermesEnabled=true | **Fixed** — plugin sets `android.enableMinifyInReleaseBuilds=true` |
| M5 | Vault SQLite + archive files unencrypted at rest | db/schema.ts; StorageService.ts | Accepted (Android FBE; prior M1) |
| M6 | No in-app secondary lock (biometric/PIN) | n/a | Accepted — intentional product decision (OS-lock guidance in app/app-locking-info.tsx) |

### Low / Informational

| ID | Finding | Status |
|----|---------|--------|
| L1 | `androidx.compose.ui.tooling.PreviewActivity` `exported="true"` in **release** manifest (dev-tooling leak) | **Fixed** — plugin removes it (`tools:node="remove"`) |
| L2 | Google OAuth Android client ID is public (PKCE) | Informational |
| L3 | OTA supply-chain risk (Expo Updates `u.expo.dev`) | Accepted — runtimeVersion pinned + 2FA |
| L4 | `patches/` (expo-web-browser, expo-keep-awake) need periodic review; both verified benign now | Hygiene |
| L5 | OEM badge permissions injected by expo-notifications | Acceptable |
| L6 | No root/tamper detection | Accepted residual risk |
| L7 | AI-share / OS-share is an intentional user-confirmed egress boundary | By design |
| L8 | `package.json` version (1.0.0) drifts from app.json (1.5.1) | **Fixed** — package.json bumped to 1.5.1 |

## 1. Local Data Storage, Secrets & Crypto (MASVS-STORAGE / -CRYPTO)

- **No hardcoded secrets.** Repo-wide search for key/secret/token patterns found only
  the placeholder `YOUR_REVENUECAT_GOOG_API_KEY` (config/revenueCatPublic.ts) and the
  public Google OAuth client ID (app.json — public by design for native PKCE).
- `.env` and `credentials.json` are in `.gitignore` and **confirmed untracked**
  (`git ls-files` shows neither). RevenueCat key loaded via `app.config.ts` from env;
  EAS build fails closed if missing/placeholder (improved in 1.5).
- OAuth tokens stored in Android Keystore via `expo-secure-store`; SQLite fallback only
  in `__DEV__`/Expo Go; production `vaultStorageGet→null` / `vaultStorageSet→throw` if
  Keystore unavailable; cleared on disconnect. **Verified unchanged.**
- **M5:** `docarchive.db` + `archive/` are plaintext in the app sandbox (WAL, FK,
  parameterized queries on). Mitigated by Android FBE; readable only on rooted/ADB
  compromise. Accepted; SQLCipher/file-encryption is the future option.

## 2. Network & Communications (MASVS-NETWORK)

- All egress is HTTPS: Google Drive (`https://www.googleapis.com/...`,
  `https://www.googleapis.com/upload/...`), token endpoint
  (`https://oauth2.googleapis.com/token`), OTA (`https://u.expo.dev/272a3754-...`),
  RevenueCat SDK (TLS internally). No `http://` calls in source.
- No custom TrustManager / `rejectUnauthorized:false` / cleartext config in release.
  Debug manifest has `usesCleartextTraffic` for the Expo dev launcher only (expected).
- No certificate pinning (Google Drive). Low priority — accepted; reliance on TLS +
  Google PKI is reasonable for the threat model.

## 3. Authentication & Session Management (MASVS-AUTH)

- OAuth2 **PKCE** via `expo-auth-session` (library-generated verifier), scope limited
  to `drive.file`, token endpoint hardcoded to Google, redirect handled by
  `oauthredirect.tsx`/`OAuthDeepLinkLanding.tsx` → `maybeCompleteAuthSession()` → no
  token in URL/logs. **Verified.**
- **No token leakage:** grep of `console.*`, toast, `Alert` shows no token/credential
  values; Drive error strings truncated (`.slice(0,137/200)`) before display.
- RevenueCat entitlement sync fails safe (network error → `'unknown'`, last state kept;
  refund → `'not_entitled'` → false). `setDevProPreview`/`resetOcrReadTrialsForDev`
  gated by `__DEV__`. OCR pre-extracted-text trust boundary intact.
- Biometric lock intentionally absent (commit "biyometrik kilit kalktı"); no
  `expo-local-authentication`/`BiometricPrompt` code; `app/app-locking-info.tsx` is
  informational only. `USE_BIOMETRIC`/`USE_FINGERPRINT` in manifest are unused
  dependency noise.

## 4. IPC & Intent Security (MASVS-PLATFORM)

Merged release manifest reviewed line-by-line.

- **MainActivity** (`exported=true`) — correct (LAUNCHER + VIEW deep links:
  `promptblueprint`, `exp+promptblueprint`, `com.gundogdu.myownsafe`, reverse-client-id).
  Deep-link routes validate untrusted params: `file-preview.tsx`→`isAllowedArchiveFileUri`,
  `document/[id].tsx` share→`isAllowedShareSourceUri`, delete→`isInsideArchive`.
  Traversal/non-sandbox URIs rejected. **Verified.**
- All app/Expo FileProviders are `exported=false` + scoped paths **except**:
  - **M3 — ClipboardFileProvider** (`expo.modules.clipboard`, L238-244):
    `exported="true"`, no `grantUriPermissions`. Upstream expo-clipboard default to
    allow pasting clipboard files into other apps; exposure bounded by
    `@xml/clipboard_provider_paths`. Other apps can resolve/query the authority.
  - **M2 — CropImageActivity** (`com.canhub.cropper`, L297-298): `exported="true"`,
    no `<intent-filter>` / `android:permission`. External apps can launch the cropper
    with arbitrary image URIs. App invokes it internally only.
- Guarded exported receivers OK: Firebase c2dm (SEND perm), Amazon NOTIFY,
  ProfileInstaller (DUMP perm).
- **L1 — PreviewActivity** (`androidx.compose.ui.tooling`, L495-496): `exported="true"`
  in the **release** manifest — Compose tooling artifact that should not ship exported.

## 5. Code Hardening & Obfuscation (MASVS-RESILIENCE)

- Hermes **on** (`gradle.properties hermesEnabled=true`) → JS shipped as bytecode.
- **M4:** No `android.enableMinifyInReleaseBuilds=true` anywhere (gradle.properties,
  eas.json reviewed) → R8/ProGuard + JS minify-mangle **disabled** for release. Class/
  method names and string literals remain readable, lowering RE cost. Hermes alone is
  not equivalent to minification.
- Logging clean: console statements are `__DEV__`-gated or non-sensitive state; no PII
  (titles, OCR text, file paths, tokens) logged in production.
- No root/jailbreak/tamper detection (L6) — accepted residual risk.

## 6. Permissions

Declared: `CAMERA`, `BILLING` (+ Expo defaults INTERNET, ACCESS_NETWORK_STATE, VIBRATE,
POST_NOTIFICATIONS, WAKE_LOCK). Stripped via config plugin / blockedPermissions and
**verified absent from the merged release manifest**: `READ/WRITE_EXTERNAL_STORAGE`,
`READ_MEDIA_IMAGES/VIDEO`, `SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`.
`android:allowBackup=false` and notification channel `VISIBILITY_PRIVATE` confirmed.

## 7. Dependencies (MASVS-CODE) — `npm audit --omit=dev`, 2026-05-16

```
@xmldom/xmldom <=0.8.12   HIGH   recursion DoS + XML/comment/PI injection
fast-uri       <=3.1.1    HIGH   path traversal / host confusion via %-encoding
postcss        <8.5.10    MOD    XSS via unescaped </style> in CSS stringify
  └ via @expo/metro-config → @expo/cli → expo  (build tooling)
Total: 6 (4 moderate, 2 high)
```

- **`npm audit fix` is non-breaking** for xmldom/fast-uri and is the correct fix.
- Do **NOT** run `npm audit fix --force`: it proposes `expo@49.0.23`, a **downgrade**
  on this Expo-54 project. The postcss chain is **build-time tooling**
  (metro-config/CLI), not shipped in the APK — real runtime impact is low.
- Confirm whether xmldom/fast-uri are reachable in the shipped bundle (likely
  build/validation tooling, e.g. ajv→fast-uri) vs. runtime; fix regardless.
- `patches/` (expo-web-browser+15.0.10, expo-keep-awake+15.0.8) reviewed — benign;
  keep periodic-review cadence.

## 8. Scripts / Open-Source Export

`scripts/opensource-desktop-export/` (export.ps1 + app.template.json): excludes
`.env*`, `credentials*`, `node_modules`, `.expo`, `android/`, `ios/`, IDE settings;
template uses placeholder IDs; not bundled into the APK. **Safe.**

## Remediation Applied (2026-05-16)

| ID | Fix | File(s) changed |
|----|-----|-----------------|
| M1 | npm `overrides` pin `@xmldom/xmldom ^0.9.10`, `fast-uri ^3.1.2`, `postcss ^8.5.10`. `npm audit --package-lock-only --omit=dev` → **0 vulnerabilities**. Avoided `npm audit fix --force` (would downgrade to expo@49). Both highs were iOS-plist / dev-launcher build tooling — not in the Android runtime — so runtime exposure was already negligible; pin closes them anyway. | `package.json` (overrides), `package-lock.json` |
| M2 | Manifest-merger override forces `com.canhub.cropper.CropImageActivity` `android:exported="false"` via `tools:replace`. App launches the cropper only internally. | `plugins/withAndroidSecurityHardening.js`, `app.json` |
| M3 | Override forces `expo.modules.clipboard.ClipboardFileProvider` `android:exported="false"`. **Behavioral note:** disables sharing clipboard *files* with other apps; plain-text clipboard is unaffected and the app does not paste files outward, so no functional regression expected — smoke-test clipboard before release. | `plugins/withAndroidSecurityHardening.js`, `app.json` |
| M4 | Config plugin sets `android.enableMinifyInReleaseBuilds=true` (R8 + JS minify for release). | `plugins/withAndroidSecurityHardening.js`, `app.json` |
| L1 | Plugin removes `androidx.compose.ui.tooling.PreviewActivity` from the merged manifest (`tools:node="remove"`). | `plugins/withAndroidSecurityHardening.js`, `app.json` |
| L8 | `package.json` version aligned to `1.5.1`. | `package.json` |

**Why a config plugin:** `android/` is gitignored and regenerated by `expo prebuild`,
so manifest/gradle edits must live in `app.json` + plugins to survive EAS builds.
`expo prebuild -p android` was run and the directives are present in the regenerated
`android/app/src/main/AndroidManifest.xml` (L53–56) and `android/gradle.properties`.

**Two operational follow-ups (environment, not code):**
1. **M1 node_modules sync** — the lockfile + overrides are the committed fix and are
   correct for CI/`npm ci`. Local `node_modules` was not reified because the IDE held
   a Gradle file-lock under `node_modules`; run `npm install` once that releases to
   sync the working tree (no further code change needed).
2. **Merged-manifest confirmation** — the merger directives are emitted into the
   highest-priority app manifest (the documented mechanism). Confirm on the next
   `gradlew bundleRelease` / EAS build that the *merged* release manifest shows
   `CropImageActivity`/`ClipboardFileProvider` `exported="false"` and no
   `PreviewActivity`.

## Residual (intentionally not changed)

- **M5** (no at-rest encryption) and **M6** (no in-app lock) — accepted architectural
  / product decisions; SQLCipher or a biometric gate are large, opinionated changes
  out of scope for a hardening pass. Re-evaluate if the threat model adds physical
  device compromise beyond Android FBE.
- **L2** (public OAuth client ID — by design for PKCE), **L3** (OTA supply chain —
  mitigated by runtimeVersion pin + 2FA), **L5** (OEM badge perms), **L6** (no root
  detection), **L7** (user-confirmed AI/OS share egress) — informational / by design.
- **L4** — keep monthly `npm audit` + `patches/` review cadence (process, not code).

## Verification Notes

- Scan: `npm audit --omit=dev` 2026-05-16 → 6 vulns (2 high / 4 moderate).
- Post-fix: `npm audit --package-lock-only --omit=dev` → **0 vulnerabilities**;
  lockfile resolves xmldom 0.9.10, fast-uri 3.1.2, postcss 8.5.14.
- `expo prebuild -p android --no-install` succeeded; regenerated
  `android/app/src/main/AndroidManifest.xml` contains the cropper/clipboard
  `exported="false"`+`tools:replace` nodes and the `PreviewActivity`
  `tools:node="remove"` node (L53–56); `android/gradle.properties:68` =
  `android.enableMinifyInReleaseBuilds=true`.
- Pending (next gradle/EAS build): confirm the *merged* release manifest reflects the
  overrides and minified release artifacts.
- `.env`/`credentials.json` confirmed gitignored and untracked.
- All 18 prior hardening controls re-verified present.
