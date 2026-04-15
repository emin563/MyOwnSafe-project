import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Build-time config.
 *
 * IMPORTANT:
 * - Do not commit secrets into `app.json`.
 * - Inject via environment variables in CI/EAS (e.g. `REVENUECAT_API_KEY`).
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

  return {
    // `config` is a partial ExpoConfig; preserve it but ensure required fields exist for typing.
    ...base,
    plugins,
    extra: {
      ...extra,
      revenueCatApiKey:
        (process.env.REVENUECAT_API_KEY?.trim() ||
          (typeof extra.revenueCatApiKey === 'string' ? extra.revenueCatApiKey : '') ||
          '') as string,
    },
  };
};

