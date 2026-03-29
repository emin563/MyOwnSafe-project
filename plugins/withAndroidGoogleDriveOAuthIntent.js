const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/**
 * Registers intent filters for Google OAuth native redirect schemes on MainActivity.
 * expo.scheme (e.g. promptblueprint) alone is not enough: Google Android clients use
 * com.googleusercontent.apps.<id>:/oauth2redirect or <applicationId>:/oauth2redirect.
 * Without these <data android:scheme="..."/> entries, Android never delivers the deep link
 * and expo-auth-session resolves with { type: 'dismiss' }.
 */
const OAUTH_SCHEMES = [
  'com.gundogdu.myownsafe',
  'com.googleusercontent.apps.655562571949-piv74f9gp1tp91m7et3ftv502pl9kuhn',
];

function normalizeIntentFilters(activity) {
  const raw = activity['intent-filter'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function collectBrowsableSchemes(activity) {
  const schemes = new Set();
  for (const filter of normalizeIntentFilters(activity)) {
    const actions = filter.action || [];
    const actionList = Array.isArray(actions) ? actions : [actions];
    const hasView = actionList.some((a) => a.$?.['android:name'] === 'android.intent.action.VIEW');
    if (!hasView) continue;
    const data = filter.data;
    const dataList = Array.isArray(data) ? data : data ? [data] : [];
    for (const d of dataList) {
      const s = d.$?.['android:scheme'];
      if (s) schemes.add(s);
    }
  }
  return schemes;
}

function withAndroidGoogleDriveOAuthIntent(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    const schemes = collectBrowsableSchemes(activity);
    if (OAUTH_SCHEMES.every((s) => schemes.has(s))) {
      return config;
    }

    const existing = normalizeIntentFilters(activity);
    const newFilter = {
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [
        { $: { 'android:name': 'android.intent.category.DEFAULT' } },
        { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
      ],
      data: OAUTH_SCHEMES.map((scheme) => ({ $: { 'android:scheme': scheme } })),
    };
    activity['intent-filter'] = [...existing, newFilter];
    return config;
  });
}

module.exports = withAndroidGoogleDriveOAuthIntent;
