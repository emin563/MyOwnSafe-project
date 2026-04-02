import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import { REVENUECAT_API_KEY, REVENUECAT_ENTITLEMENT_ID } from '@/config/revenueCat';

let configured = false;

export function configureRevenueCat(): void {
  if (configured || !REVENUECAT_API_KEY || REVENUECAT_API_KEY === 'YOUR_REVENUECAT_GOOG_API_KEY') {
    return;
  }
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey: REVENUECAT_API_KEY });
  configured = true;
}

function hasProEntitlement(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[REVENUECAT_ENTITLEMENT_ID] !== 'undefined';
}

export async function checkProEntitlement(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return hasProEntitlement(info);
  } catch {
    return false;
  }
}

export async function getProPackage(): Promise<PurchasesPackage | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages[0] ?? null;
  } catch {
    return null;
  }
}

export type PurchaseResult =
  | { success: true }
  | { success: false; cancelled: boolean; message: string };

export async function purchasePro(): Promise<PurchaseResult> {
  const pkg = await getProPackage();
  if (!pkg) {
    return { success: false, cancelled: false, message: 'No product available. Please try again later.' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (hasProEntitlement(customerInfo)) {
      return { success: true };
    }
    return { success: false, cancelled: false, message: 'Purchase completed but entitlement not found. Please restore.' };
  } catch (e: any) {
    if (e.userCancelled) {
      return { success: false, cancelled: true, message: '' };
    }
    return { success: false, cancelled: false, message: e.message ?? 'Purchase failed.' };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!configured) {
    return { success: false, cancelled: false, message: 'Purchases not configured.' };
  }
  try {
    const info = await Purchases.restorePurchases();
    if (hasProEntitlement(info)) {
      return { success: true };
    }
    return { success: false, cancelled: false, message: 'No previous Pro purchase found for this account.' };
  } catch (e: any) {
    return { success: false, cancelled: false, message: e.message ?? 'Restore failed.' };
  }
}
