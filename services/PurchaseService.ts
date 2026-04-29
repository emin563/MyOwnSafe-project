import Purchases, {
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import {
  REVENUECAT_API_KEY,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_PRODUCT_ID,
} from '@/config/revenueCat';
import { isRevenueCatPublicKeyUnset } from '@/config/revenueCatPublic';

let configured = false;

function isRevenueCatApiKeyPlaceholder(): boolean {
  return isRevenueCatPublicKeyUnset(REVENUECAT_API_KEY);
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export function configureRevenueCat(): void {
  if (configured) return;
  if (isRevenueCatApiKeyPlaceholder()) {
    return;
  }
  Purchases.configure({ apiKey: REVENUECAT_API_KEY });
  configured = true;
}

function hasProEntitlement(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[REVENUECAT_ENTITLEMENT_ID] !== 'undefined';
}

/** Native SDK may surface `code` as string or number. */
function purchaseErrorCode(e: unknown): string | undefined {
  const c = (e as { code?: string | number })?.code;
  return c === undefined || c === null ? undefined : String(c);
}

function isPaymentPendingError(e: unknown): boolean {
  const c = purchaseErrorCode(e);
  return c === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR || c === '20';
}

function isProductAlreadyPurchasedError(e: unknown): boolean {
  const c = purchaseErrorCode(e);
  return c === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR || c === '6';
}

/** Play Billing returned SERVICE_UNAVAILABLE / billing client not ready — not a missing product id. */
function isStoreProblemError(e: unknown): boolean {
  const c = purchaseErrorCode(e);
  if (
    c === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR ||
    c === PURCHASES_ERROR_CODE.NETWORK_ERROR ||
    c === PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR ||
    c === '2' ||
    c === '10' ||
    c === '35'
  ) {
    return true;
  }
  if (typeof c === 'string' && /storeproblem/i.test(c)) {
    return true;
  }
  const ex = e as { underlyingErrorMessage?: string; message?: string };
  const blob = `${ex?.message ?? ''} ${ex?.underlyingErrorMessage ?? ''}`;
  return /SERVICE_UNAVAILABLE|Billing is unavailable|problem with the store/i.test(blob);
}

const STORE_UNAVAILABLE_USER_MESSAGE =
  'Google Play Billing is temporarily unavailable (often SERVICE_UNAVAILABLE). Update the Play Store app, clear its cache, check your network, wait a few minutes, then try again. This is not caused by your RevenueCat product id.';

const PAYMENT_PENDING_USER_MESSAGE =
  'Google Play has a pending or incomplete payment for this product. Open the Play Store → Payments & subscriptions, finish or cancel it, then try again. After a refund, wait up to 48 hours for Play to update, or use a different test account.';

const ALREADY_OWNED_USER_MESSAGE =
  'Play already shows this purchase on your account. If RevenueCat has not synced yet, tap Restore; if you were refunded, wait until Play clears ownership (can take hours) or use a different test account.';

/** Shown in release when `extra.revenueCatApiKey` was empty at build time (EAS / .env not set when the binary was produced). */
const BILLING_NOT_CONFIGURED_RELEASE_MESSAGE =
  'Purchases are disabled in this build because the RevenueCat public SDK key was not embedded at build time. Set REVENUECAT_API_KEY in Expo → Environment variables for the production environment, run a new EAS Android build, then publish that version to the Play Store.';

/** Rare: SDK key looks valid but `Purchases.configure` never completed (e.g. init failure). */
const BILLING_INIT_UNAVAILABLE_MESSAGE =
  'Purchases could not be initialized. Please restart the app and try again.';

/** Play Billing ITEM_UNAVAILABLE in dev is very often a sideloaded build — not Play-store–installed. */
const PRODUCT_NOT_AVAILABLE_DEV_MESSAGE =
  'Google Play could not complete this purchase (ITEM_UNAVAILABLE). Real purchases usually fail on development installs (e.g. “expo run:android” or adb). Upload an AAB to Play internal testing, install the app from the Play Store with a license-test account, then try again.';

const PRODUCT_NOT_AVAILABLE_RELEASE_MESSAGE =
  'Google Play could not sell this product (ITEM_UNAVAILABLE). Install the app from the Play Store (internal/closed/open testing or production), confirm vault_pro_lifetime is Active in Play Console, and in RevenueCat set this SKU as a non-subscription product that matches Play.';

function productNotAvailableUserMessage(): string {
  return __DEV__ ? PRODUCT_NOT_AVAILABLE_DEV_MESSAGE : PRODUCT_NOT_AVAILABLE_RELEASE_MESSAGE;
}

/**
 * Result of asking RevenueCat for current entitlement.
 * - `unknown`: SDK call failed (network, outage, etc.) — keep last persisted purchase state; do not revoke Pro.
 * - `not_entitled`: Got `CustomerInfo` and the pro entitlement is inactive (incl. refund/expiry when RC reflects it).
 */
export type ProEntitlementSyncResult = 'entitled' | 'not_entitled' | 'unknown';

export async function syncProEntitlementFromRevenueCat(): Promise<ProEntitlementSyncResult> {
  if (!configured) return 'not_entitled';
  try {
    const info = await Purchases.getCustomerInfo();
    return hasProEntitlement(info) ? 'entitled' : 'not_entitled';
  } catch {
    return 'unknown';
  }
}

/**
 * Legacy boolean API (still referenced by some bundles/tests). True only when sync returns `entitled`;
 * `false` for `not_entitled` or `unknown`. Prefer `syncProEntitlementFromRevenueCat` in the store so
 * `unknown` does not revoke persisted Pro.
 */
export async function checkProEntitlement(): Promise<boolean> {
  const r = await syncProEntitlementFromRevenueCat();
  return r === 'entitled';
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

/**
 * Load the Pro SKU as a non-subscription (one-time) product.
 * Prefer `PRODUCT_CATEGORY.NON_SUBSCRIPTION` (SDK `getProducts` defaults to subscription category).
 */
export async function getProStoreProduct(): Promise<PurchasesStoreProduct | null> {
  if (!configured) return null;
  try {
    const products = await Purchases.getProducts([REVENUECAT_PRODUCT_ID], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    return products[0] ?? null;
  } catch {
    return null;
  }
}

type ProPurchaseTarget =
  | { kind: 'product'; product: PurchasesStoreProduct }
  | { kind: 'package'; pkg: PurchasesPackage }
  | { kind: 'billing_unavailable' }
  | { kind: 'not_found' };

/**
 * Prefer INAPP product fetch, then offerings. Distinguish Play Billing outages from missing SKUs.
 */
async function resolveProPurchaseTarget(): Promise<ProPurchaseTarget> {
  if (!configured) return { kind: 'not_found' };
  try {
    const products = await Purchases.getProducts([REVENUECAT_PRODUCT_ID], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    if (products[0]) {
      return { kind: 'product', product: products[0] };
    }
  } catch (e: unknown) {
    if (isStoreProblemError(e)) {
      return { kind: 'billing_unavailable' };
    }
  }
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages[0];
    if (pkg) {
      return { kind: 'package', pkg };
    }
  } catch (e: unknown) {
    if (isStoreProblemError(e)) {
      return { kind: 'billing_unavailable' };
    }
  }
  return { kind: 'not_found' };
}

export type PurchaseResult =
  | { success: true }
  | { success: false; cancelled: boolean; message: string };

function handlePurchaseFlowError(e: any): PurchaseResult {
  if (e.userCancelled) {
    return { success: false, cancelled: true, message: '' };
  }
  if (isPaymentPendingError(e)) {
    return { success: false, cancelled: false, message: PAYMENT_PENDING_USER_MESSAGE };
  }
  if (isStoreProblemError(e)) {
    return { success: false, cancelled: false, message: STORE_UNAVAILABLE_USER_MESSAGE };
  }
  /** Play reports ownership; RC may still be syncing. Prefer getCustomerInfo, then restore. */
  if (isProductAlreadyPurchasedError(e)) {
    return { success: false, cancelled: false, message: ALREADY_OWNED_USER_MESSAGE };
  }
  if (purchaseErrorCode(e) === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR) {
    return {
      success: false,
      cancelled: false,
      message: productNotAvailableUserMessage(),
    };
  }
  if (purchaseErrorCode(e) === PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR) {
    return {
      success: false,
      cancelled: false,
      message:
        'Could not verify the purchase with RevenueCat (store receipt sync failed). Check your connection, tap Restore, or try again later. If this persists, confirm the product is a one-time purchase (not subscription) in RevenueCat and check status.revenuecat.com.',
    };
  }
  return { success: false, cancelled: false, message: e.message ?? 'Purchase failed.' };
}

/**
 * After ITEM_ALREADY_OWNED, try to refresh RC entitlements without surfacing raw Play errors.
 */
async function recoverAlreadyOwnedPurchase(): Promise<PurchaseResult> {
  try {
    const info = await Purchases.getCustomerInfo();
    if (hasProEntitlement(info)) {
      return { success: true };
    }
  } catch {
    /* ignore */
  }
  try {
    const info = await Purchases.restorePurchases();
    if (hasProEntitlement(info)) {
      return { success: true };
    }
    return {
      success: false,
      cancelled: false,
      message: ALREADY_OWNED_USER_MESSAGE,
    };
  } catch (re: any) {
    if (isPaymentPendingError(re)) {
      return { success: false, cancelled: false, message: PAYMENT_PENDING_USER_MESSAGE };
    }
    if (isStoreProblemError(re)) {
      return { success: false, cancelled: false, message: STORE_UNAVAILABLE_USER_MESSAGE };
    }
    return {
      success: false,
      cancelled: false,
      message: re.message ?? 'Could not sync your existing purchase. Try Restore.',
    };
  }
}

export async function purchasePro(): Promise<PurchaseResult> {
  if (!configured) {
    return {
      success: false,
      cancelled: false,
      message: isRevenueCatApiKeyPlaceholder()
        ? __DEV__
          ? 'RevenueCat API key is missing — add REVENUECAT_API_KEY to a gitignored .env, run npm run env:pull:dev after setting it in EAS, or set it in EAS Environment variables for your build profile, then rebuild.'
          : BILLING_NOT_CONFIGURED_RELEASE_MESSAGE
        : BILLING_INIT_UNAVAILABLE_MESSAGE,
    };
  }

  const target = await resolveProPurchaseTarget();
  if (target.kind === 'billing_unavailable') {
    return { success: false, cancelled: false, message: STORE_UNAVAILABLE_USER_MESSAGE };
  }
  if (target.kind === 'not_found') {
    return {
      success: false,
      cancelled: false,
      message:
        'No product available from the store. Confirm vault_pro_lifetime is a managed (one-time) product in Play Console and linked as non-consumable in RevenueCat — or Google Play Billing was down; if Play Store shows errors too, try again later.',
    };
  }

  const purchaseFn =
    target.kind === 'product'
      ? () => Purchases.purchaseStoreProduct(target.product)
      : () => Purchases.purchasePackage(target.pkg);

  try {
    const { customerInfo } = await purchaseFn();
    if (hasProEntitlement(customerInfo)) {
      return { success: true };
    }
    return { success: false, cancelled: false, message: 'Purchase completed but entitlement not found. Please restore.' };
  } catch (e: any) {
    if (isProductAlreadyPurchasedError(e)) {
      return recoverAlreadyOwnedPurchase();
    }
    return handlePurchaseFlowError(e);
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!configured) {
    return {
      success: false,
      cancelled: false,
      message: isRevenueCatApiKeyPlaceholder()
        ? __DEV__
          ? 'RevenueCat API key is missing — add REVENUECAT_API_KEY to a gitignored .env or EAS Environment variables for your build profile, then rebuild.'
          : BILLING_NOT_CONFIGURED_RELEASE_MESSAGE
        : BILLING_INIT_UNAVAILABLE_MESSAGE,
    };
  }
  try {
    const info = await Purchases.restorePurchases();
    if (hasProEntitlement(info)) {
      return { success: true };
    }
    return { success: false, cancelled: false, message: 'No previous Pro purchase found for this account.' };
  } catch (e: any) {
    if (isPaymentPendingError(e)) {
      return { success: false, cancelled: false, message: PAYMENT_PENDING_USER_MESSAGE };
    }
    if (isStoreProblemError(e)) {
      return { success: false, cancelled: false, message: STORE_UNAVAILABLE_USER_MESSAGE };
    }
    if (purchaseErrorCode(e) === PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR) {
      return {
        success: false,
        cancelled: false,
        message:
          'Could not verify purchases with RevenueCat (receipt sync failed). Check your connection or try again later.',
      };
    }
    return { success: false, cancelled: false, message: e.message ?? 'Restore failed.' };
  }
}
