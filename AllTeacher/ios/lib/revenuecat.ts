/**
 * RevenueCat client.
 *
 * Setup:
 *   npx expo install react-native-purchases
 *   Add "react-native-purchases" to plugins in app.json
 *
 * Tier ladder: free → starter (€3) → pro (€8) → power (€15)
 */
import Purchases, { LOG_LEVEL, type PurchasesPackage } from "react-native-purchases";
import { Platform } from "react-native";

const RC_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!;

// Product IDs must match exactly what's in App Store Connect
const PRODUCT_IDS: Record<"starter" | "pro" | "power", string> = {
  starter: "com.allteacher.app.starter.monthly",
  pro:     "com.allteacher.app.pro.monthly",
  power:   "com.allteacher.app.power.monthly",
};

// RevenueCat package identifiers set in the dashboard.
// Used as fallback on simulator where StoreKit returns no product data.
const RC_PACKAGE_IDS: Record<"starter" | "pro" | "power", string> = {
  starter: "$rc_monthly",
  pro:     "custom_pro",
  power:   "custom_power",
};

// ─── Init ─────────────────────────────────────────────────────────────────────

/** Call once at app startup, before any purchase screens render. */
export function configureRevenueCat() {
  if (Platform.OS !== "ios") return;
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: RC_IOS_KEY });
  } catch (e) {
    // Silently skip in Expo Go — native store not available there.
    // Run via `npx expo run:ios` to test purchases.
    console.warn("[RevenueCat] configure failed (Expo Go?):", e);
  }
}

/**
 * Call after Supabase login so RevenueCat ties purchases to the user.
 * This lets you see per-user purchase history in the RevenueCat dashboard.
 */
export async function identifyUser(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch {
    // best-effort — purchases still work anonymously
  }
}

/** Call on logout to clear the RevenueCat identity. */
export async function resetUser(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch {
    // best-effort
  }
}

// ─── Tier ─────────────────────────────────────────────────────────────────────

export type RCTier = "free" | "starter" | "pro" | "power";

/**
 * Reads the user's active entitlement from RevenueCat.
 * Use this as the source of truth for feature gating on the client.
 */
export async function getActiveTier(): Promise<RCTier> {
  try {
    const info = await Purchases.getCustomerInfo();
    const active = info.entitlements.active;
    if (active["power"])   return "power";
    if (active["pro"])     return "pro";
    if (active["starter"]) return "starter";
    return "free";
  } catch (e) {
    // Returns "free" in Expo Go or if native store unavailable
    return "free";
  }
}

// ─── Purchases ────────────────────────────────────────────────────────────────

/**
 * Finds the RevenueCat package for a tier by matching the product ID.
 * Requires a default Offering to be configured in the RevenueCat dashboard.
 */
export async function getPackageForTier(
  tier: "starter" | "pro" | "power",
): Promise<PurchasesPackage | null> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    const pkgs = current?.availablePackages ?? [];
    const targetId = PRODUCT_IDS[tier];

    // Debug — remove before shipping to production
    console.log("[RC] current offering:", current?.identifier ?? "null");
    console.log("[RC] availablePackages count:", pkgs.length);
    pkgs.forEach((p) =>
      console.log(
        `[RC]   pkg identifier="${p.identifier}" productId="${p.product.productIdentifier}"`,
      ),
    );
    console.log("[RC] looking for productId:", targetId);

    // Primary: match by Apple product ID (works on device + with StoreKit config)
    let found = pkgs.find((p) => p.product.productIdentifier === targetId) ?? null;

    // Fallback: match by RevenueCat package identifier (works on simulator
    // when StoreKit config isn't loaded and productIdentifier comes back undefined)
    if (!found) {
      const rcId = RC_PACKAGE_IDS[tier];
      found = pkgs.find((p) => p.identifier === rcId) ?? null;
      if (found) console.log("[RC] matched via RC package identifier:", rcId);
    }

    console.log("[RC] found:", found ? found.identifier : "null");
    return found;
  } catch (e) {
    console.error("[RC] getPackageForTier error:", e);
    return null;
  }
}

/**
 * Triggers the Apple IAP sheet for a given tier.
 * Throws if the package isn't found or the purchase fails.
 * The caller should catch `userCancelled` from the error and handle silently.
 */
export async function purchaseTier(tier: "starter" | "pro" | "power") {
  const pkg = await getPackageForTier(tier);
  if (!pkg) {
    throw new Error(
      "This plan isn't available right now — please try again later.",
    );
  }
  return Purchases.purchasePackage(pkg);
}

/**
 * Restores previous purchases — required by Apple review guidelines.
 * Returns updated CustomerInfo with any restored entitlements.
 */
export async function restorePurchases() {
  return Purchases.restorePurchases();
}

// ─── Legacy stub shape (backwards compat) ─────────────────────────────────────

export const revenuecat = { tier: getActiveTier };
