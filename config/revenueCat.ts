import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const REVENUECAT_API_KEY: string = extra.revenueCatApiKey ?? '';
export const REVENUECAT_ENTITLEMENT_ID = 'pro_access';
/** Play / App Store product id (must match RevenueCat + store consoles). */
export const REVENUECAT_PRODUCT_ID = 'vault_pro_lifetime';
