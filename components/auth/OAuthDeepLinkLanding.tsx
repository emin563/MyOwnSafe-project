import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

/**
 * OAuth callbacks sometimes use the app scheme (e.g. promptblueprint://oauth2redirect?code=...).
 * Expo Router would otherwise show "Unmatched Route"; we bounce to Settings where Drive UI reflects link state.
 */
export function OAuthDeepLinkLanding() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings');
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.surface,
      }}
    >
      <ActivityIndicator color={Colors.primary} />
    </View>
  );
}
