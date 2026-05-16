const { withAndroidManifest, withGradleProperties } = require('expo/config-plugins');

/**
 * Security hardening that must survive `expo prebuild` (the native `android/` dir is
 * gitignored and regenerated). Addresses audit findings in Plan.md/security.md:
 *
 *  - M2: `com.canhub.cropper.CropImageActivity` is contributed by a dependency with
 *        `android:exported="true"` and no guards, so any installed app can launch the
 *        in-app cropper with arbitrary URIs. The app only ever starts it internally,
 *        so we force `exported="false"`.
 *  - M3: `expo.modules.clipboard.ClipboardFileProvider` ships `exported="true"`
 *        (upstream expo-clipboard default). We force `exported="false"`. NOTE: this
 *        intentionally disables sharing clipboard *files* with other apps; plain
 *        text clipboard is unaffected. The app does not paste files into other apps.
 *  - L1: `androidx.compose.ui.tooling.PreviewActivity` (Compose @Preview tooling)
 *        leaks into the release manifest exported; it has no place in production.
 *  - M4: enable R8 + JS minification for release builds (Hermes bytecode alone is
 *        not equivalent to symbol mangling).
 *
 * The manifest changes are expressed as Android manifest-merger directives
 * (`tools:replace` / `tools:node="remove"`) so the app manifest (highest priority)
 * overrides the values the libraries contribute at merge time. `xmlns:tools` is
 * already declared on <manifest> by the Expo template.
 */

const CROP_IMAGE_ACTIVITY = 'com.canhub.cropper.CropImageActivity';
const CLIPBOARD_FILE_PROVIDER = 'expo.modules.clipboard.ClipboardFileProvider';
const COMPOSE_PREVIEW_ACTIVITY = 'androidx.compose.ui.tooling.PreviewActivity';
const MINIFY_PROP = 'android.enableMinifyInReleaseBuilds';

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function hasNamedNode(list, name) {
  return ensureArray(list).some((node) => node?.$?.['android:name'] === name);
}

function withSecureAndroidManifest(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('[withAndroidSecurityHardening] <application> not found in AndroidManifest.');
    }

    application.activity = ensureArray(application.activity);
    application.provider = ensureArray(application.provider);

    // M2 — force CropImageActivity (dependency-contributed) to exported="false".
    if (!hasNamedNode(application.activity, CROP_IMAGE_ACTIVITY)) {
      application.activity.push({
        $: {
          'android:name': CROP_IMAGE_ACTIVITY,
          'android:exported': 'false',
          'tools:replace': 'android:exported',
        },
      });
    }

    // L1 — strip the Compose tooling PreviewActivity from the merged manifest.
    if (!hasNamedNode(application.activity, COMPOSE_PREVIEW_ACTIVITY)) {
      application.activity.push({
        $: {
          'android:name': COMPOSE_PREVIEW_ACTIVITY,
          'tools:node': 'remove',
        },
      });
    }

    // M3 — force ClipboardFileProvider (upstream expo-clipboard) to exported="false".
    // android:authorities is left to merge from the library node.
    if (!hasNamedNode(application.provider, CLIPBOARD_FILE_PROVIDER)) {
      application.provider.push({
        $: {
          'android:name': CLIPBOARD_FILE_PROVIDER,
          'android:exported': 'false',
          'tools:replace': 'android:exported',
        },
      });
    }

    return config;
  });
}

function withReleaseMinification(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    const existing = props.find(
      (item) => item.type === 'property' && item.key === MINIFY_PROP
    );
    if (existing) {
      existing.value = 'true';
    } else {
      props.push({
        type: 'property',
        key: MINIFY_PROP,
        value: 'true',
      });
    }
    return config;
  });
}

function withAndroidSecurityHardening(config) {
  config = withSecureAndroidManifest(config);
  config = withReleaseMinification(config);
  return config;
}

module.exports = withAndroidSecurityHardening;
