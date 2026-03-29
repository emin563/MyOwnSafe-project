import { OAuthDeepLinkLanding } from '@/components/auth/OAuthDeepLinkLanding';

/** Fallback when Google.useAuthRequest uses makeRedirectUri({ path: 'oauthredirect' }). */
export default function OauthRedirectRoute() {
  return <OAuthDeepLinkLanding />;
}
