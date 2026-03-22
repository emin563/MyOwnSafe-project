# Viewing files in Vault

## In-app PDF (local archive)

Vault uses **`react-native-pdf`** (plus **`react-native-blob-util`**) to render PDFs stored in the app archive. This requires **native code** that is **not** shipped inside **Expo Go**.

| Environment | In-app PDF |
|-------------|------------|
| **Expo Go** | Not available — you’ll see the placeholder message on the PDF screen. Use **Open with…** to hand off to another app. |
| **Development build** | Available — use the steps below to test. |
| **Production build** | Available. |

### How to test in-app PDF (development build)

1. **Android (local)**  
   - From the project root: `npx expo prebuild` (first time or after native dependency changes).  
   - Then: `npx expo run:android`  
   - Install the built app on a device/emulator — this binary includes `react-native-pdf` and blob-util.

2. **EAS (cloud)**  
   - Configure a **development** or **preview** profile in `eas.json` that produces an installable `.apk` / `.aab`.  
   - Run `eas build --profile development --platform android` (or use your team’s profile names).  
   - Install the artifact from the EAS build page on your phone.

3. **After installing the dev build**, open Metro with `npx expo start --dev-client` and connect the app (not Expo Go).

Config plugins in `app.json`: `@config-plugins/react-native-blob-util`, `@config-plugins/react-native-pdf`.

## “Open with…” (handoff to other apps)

- **Development / production builds (Android):** `react-native-blob-util` **`actionViewIntent`** — `ACTION_VIEW` with a **chooser title** (“Open with…”), matching the system “open with” flow when the OS shows the resolver.
- **Development / production builds (iOS):** **`presentOpenInMenu`** — “Open in…” style app picker.
- **Expo Go (Android):** **`expo-intent-launcher`** — `ACTION_VIEW` with MIME type (viewer intent, **not** the Share sheet). If the system cannot open the `file://` URI, the app falls back to **`expo-sharing`**.
- **Expo Go (iOS):** No custom native handoff — **`expo-sharing`** is used as a fallback.

Explicit **Share** / **Save to device** actions in the UI still use **`expo-sharing`** where that behavior is intended.
