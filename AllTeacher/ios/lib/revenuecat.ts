/**
 * RevenueCat client — stub.
 *
 * When wiring subscriptions, install:
 *   npx expo install react-native-purchases
 *
 * Then initialize in app/_layout.tsx with:
 *   Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY! });
 */

export const revenuecatKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";

export const revenuecat = {
  tier: async (): Promise<"free" | "pro" | "power"> => "free",
};
