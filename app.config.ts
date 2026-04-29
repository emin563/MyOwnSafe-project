import { loadProjectEnv } from '@expo/env';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'fs';
import path from 'path';

/**
 * Inlined here (no import from ./config/*.ts): EAS evaluates app.config without always transpiling
 * nested TS modules, which caused "Unexpected token '{'" on cloud builds. Logic must match
 * `config/revenueCatPublic.ts` (`isRevenueCatPublicKeyUnset`).
 */
function isRevenueCatKeyUnsetForEasBuild(key: string): boolean {
  const k = key.trim();
  return !k || k === 'YOUR_REVENUECAT_GOOG_API_KEY';
}

/**
 * Resolve repo root when `process.cwd()` is not the project root (e.g. some Gradle/CLI invocations).
 */
function resolveExpoProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (
      fs.existsSync(path.join(dir, 'app.config.ts')) ||
      fs.existsSync(path.join(dir, 'app.config.js')) ||
      fs.existsSync(path.join(dir, 'app.config.mjs'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const _expoProjectRoot = resolveExpoProjectRoot();
loadProjectEnv(_expoProjectRoot, { force: true, silent: true });

/**
 * Build-time config.
 *
 * IMPORTANT:
 * - Do not commit API keys into `app.json` (they belong in git history forever if leaked).
 * - Local / `npx expo run:*`: use a gitignored `.env` or run `npm run env:pull:dev` after storing
 *   the key in EAS (development environment).
 * - EAS Build: set `REVENUECAT_API_KEY` in Expo → Environment variables for each environment
 *   (`development` / `preview` / `production` — matches `eas.json` `environment`). Use “Sensitive”
 *   visibility for client-embedded SDK keys (not “Secret” if you need app.config resolution per Expo docs).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const extra = (config.extra ?? {}) as Record<string, unknown>;
  const base = config as ExpoConfig;
  const plugins = [...(base.plugins ?? [])];
  const hasDtPicker = plugins.some(
    (p) => p === '@react-native-community/datetimepicker' || (Array.isArray(p) && p[0] === '@react-native-community/datetimepicker')
  );
  if (!hasDtPicker) {
    plugins.push('@react-native-community/datetimepicker');
  }

  const revenueCatApiKey = (
    process.env.REVENUECAT_API_KEY?.trim() ||
    (typeof extra.revenueCatApiKey === 'string' ? extra.revenueCatApiKey : '') ||
    ''
  ) as string;

  /**
   * Fail any EAS build without a RevenueCat public SDK key so we never ship a binary where IAP is
   * silently disabled (previously only production/preview failed — development profile could still
   * produce a store-eligible AAB without the key). Keep keys in Expo Environment variables, not in git.
   */
  const easBuild =
    process.env.EAS_BUILD === 'true' || process.env.EAS_BUILD === '1';
  const easProfile = process.env.EAS_BUILD_PROFILE ?? '';
  if (easBuild && isRevenueCatKeyUnsetForEasBuild(revenueCatApiKey)) {
    throw new Error(
      `[EAS ${easProfile}] REVENUECAT_API_KEY is missing or still the placeholder. ` +
        'Add your RevenueCat public SDK key to Expo → Environment variables for this EAS environment ' +
        '(variable name: REVENUECAT_API_KEY), then rebuild. Do not commit keys to the repository.'
    );
  }

  return {
    // `config` is a partial ExpoConfig; preserve it but ensure required fields exist for typing.
    ...base,
    plugins,
    extra: {
      ...extra,
      revenueCatApiKey,
    },
  };
};

