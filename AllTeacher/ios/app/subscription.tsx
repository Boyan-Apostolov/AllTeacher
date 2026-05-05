/**
 * Subscription & Upgrade screen — shows the user's current plan and lets
 * them upgrade to Starter, Pro, or Power. Upgrade buttons are active (tappable
 * with feedback) but not connected to RevenueCat / Apple IAP yet.
 * That wiring lands in step 7b.
 *
 * Tier ladder: free (€0) → starter (€3) → pro (€8) → power (€15)
 */
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { api, type Subscription } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ScreenContainer, Toolbar, LoadingBlock, MessageBox } from "@/components/ui";
import { Sticker } from "@/components/ui/Sticker";
import { colors } from "@/lib/theme";
import { subStyles as styles } from "./subscription.styles";
import { purchaseTier, restorePurchases } from "@/lib/revenuecat";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "free" | "starter" | "pro" | "power";

interface TierFeature {
  text: string;
  tiers: Tier[]; // which tiers include this feature
}

// ─── Static plan data ─────────────────────────────────────────────────────────

const FEATURES: TierFeature[] = [
  { text: "1 active curriculum",          tiers: ["free"] },
  { text: "Up to 2 curricula",            tiers: ["starter"] },
  { text: "Up to 5 curricula",            tiers: ["pro"] },
  { text: "Unlimited curricula",          tiers: ["power"] },
  { text: "Assessor + weekly planner",    tiers: ["free", "starter", "pro", "power"] },
  { text: "Lessons + exercises",          tiers: ["free", "starter", "pro", "power"] },
  { text: "Streaming feedback",           tiers: ["free", "starter", "pro", "power"] },
  { text: "Listening exercises (TTS)",    tiers: ["starter", "pro", "power"] },
  { text: "Visual lessons (diagrams)",    tiers: ["free", "starter", "pro", "power"] },
  { text: "Adaptive re-planner",          tiers: ["starter", "pro", "power"] },
  { text: "Make it harder / Add sessions",tiers: ["pro", "power"] },
  { text: "Vocabulary bank",              tiers: ["free", "starter", "pro", "power"] },
  { text: "Priority AI (faster models)",  tiers: ["power"] },
];

const COMPARISON_FEATURES = [
  "Curricula",
  "Lessons & exercises",
  "Listening exercises",
  "Adaptive re-planner",
  "Make it harder",
  "Vocabulary bank",
  "Priority AI",
];
const COMPARISON_MATRIX: Record<string, [string, string, string, string]> = {
  "Curricula":              ["1",  "2",  "5",  "∞"],
  "Lessons & exercises":    ["✓",  "✓",  "✓",  "✓"],
  "Listening exercises":    ["✗",  "✓",  "✓",  "✓"],
  "Adaptive re-planner":    ["✗",  "✓",  "✓",  "✓"],
  "Make it harder":         ["✗",  "✗",  "✓",  "✓"],
  "Vocabulary bank":        ["✓",  "✓",  "✓",  "✓"],
  "Priority AI":            ["✗",  "✗",  "✗",  "✓"],
};

interface PlanDef {
  tier: Tier;
  emoji: string;
  name: string;
  price: string;
  pricePer: string;
  tagline: string;
  color: string;
  features: string[];
}

const PLANS: PlanDef[] = [
  {
    tier: "free",
    emoji: "🌱",
    name: "Free",
    price: "€0",
    pricePer: "forever",
    tagline: "Get started with one curriculum, full AI-powered lessons.",
    color: colors.ink3,
    features: [
      "1 active curriculum",
      "Assessor + weekly planner",
      "Lessons & exercises",
      "Streaming feedback",
      "Visual lesson diagrams",
      "Vocabulary bank",
    ],
  },
  {
    tier: "starter",
    emoji: "✦",
    name: "Starter",
    price: "€3",
    pricePer: "/ month",
    tagline: "Step up — two curricula, listening drills, and adaptive re-plans.",
    color: colors.brand,
    features: [
      "Up to 2 curricula",
      "Everything in Free",
      "Listening exercises (TTS audio)",
      "Adaptive re-planner",
    ],
  },
  {
    tier: "pro",
    emoji: "⚡",
    name: "Pro",
    price: "€8",
    pricePer: "/ month",
    tagline: "Serious learners — up to 5 goals, harder drills, full control.",
    color: colors.mc,
    features: [
      "Up to 5 curricula",
      "Everything in Starter",
      "Make it harder / Add sessions",
    ],
  },
  {
    tier: "power",
    emoji: "👑",
    name: "Power",
    price: "€15",
    pricePer: "/ month",
    tagline: "Unlimited everything — fastest models, no caps, no limits.",
    color: "#7C3AED",
    features: [
      "Unlimited curricula",
      "Everything in Pro",
      "Priority AI (faster models)",
      "Early access to new features",
    ],
  },
];

// Tier rank — used to filter out lower/equal plans
const TIER_RANK: Record<Tier, number> = { free: 0, starter: 1, pro: 2, power: 3 };

// ─── Sub-components ───────────────────────────────────────────────────────────

type CardStatus = "current" | "upgrade" | "downgrade";

function TierCard({
  plan,
  status,
  meta,
  onPress,
  disabled = false,
  loading = false,
}: {
  plan: PlanDef;
  status: CardStatus;
  meta?: string | null;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isCurrent = status === "current";

  return (
    <View style={[styles.tierCard, isCurrent && styles.tierCardActive]}>
      {/* Header */}
      <View
        style={[
          styles.tierHeader,
          isCurrent && { backgroundColor: plan.color + "14" },
        ]}
      >
        <View style={styles.tierHeaderRow}>
          <Text style={styles.tierEmoji}>{plan.emoji}</Text>
          <View style={styles.tierPriceBlock}>
            <Text style={styles.tierPrice}>{plan.price}</Text>
            <Text style={styles.tierPricePer}>{plan.pricePer}</Text>
          </View>
        </View>
        <View style={styles.tierNameRow}>
          <Text style={styles.tierName}>{plan.name}</Text>
          {isCurrent && (
            <View
              style={[styles.currentChip, { backgroundColor: plan.color }]}
            >
              <Text style={styles.currentChipText}>Active</Text>
            </View>
          )}
        </View>
        <Text style={styles.tierTagline}>{plan.tagline}</Text>
        {isCurrent && meta ? (
          <Text style={styles.currentMeta}>{meta}</Text>
        ) : null}
      </View>

      {/* Features */}
      <View style={styles.tierBody}>
        {plan.features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      {status === "current" ? (
        <View style={[styles.upgradeBtn, styles.upgradeBtnDisabled]}>
          <Text style={[styles.upgradeBtnText, styles.upgradeBtnDisabledText]}>
            Current plan
          </Text>
        </View>
      ) : status === "upgrade" ? (
        <Pressable
          style={[
            styles.upgradeBtn,
            { backgroundColor: plan.color },
            (disabled || loading) && styles.upgradeBtnDisabled,
          ]}
          onPress={onPress}
          disabled={disabled || loading}
        >
          <Text style={styles.upgradeBtnText}>
            {loading ? "Processing…" : `Upgrade to ${plan.name} →`}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.upgradeBtn, styles.downgradeBtn]}
          onPress={onPress}
          disabled={disabled || loading}
        >
          <Text style={[styles.upgradeBtnText, styles.downgradeBtnText]}>
            Switch to {plan.name}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<Tier | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session?.access_token) return;
      let cancelled = false;
      setError(null);
      setLoading(true);
      api
        .mySubscription(session.access_token)
        .then((s) => {
          if (cancelled) return;
          setSubscription(s);
          setLoading(false);
        })
        .catch((e: Error) => {
          if (cancelled) return;
          setError(e.message);
          setLoading(false);
        });
      return () => { cancelled = true; };
    }, [session?.access_token]),
  );

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  const goHome = () => router.replace("/");

  const currentTier: Tier =
    (subscription?.effective_tier as Tier) ??
    (subscription?.tier as Tier) ??
    "free";

  const loadSubscription = useCallback(() => {
    if (!session?.access_token) return;
    api.mySubscription(session.access_token).then(setSubscription).catch(() => {});
  }, [session?.access_token]);

  const handleUpgrade = async (plan: PlanDef) => {
    if (plan.tier === "free") return;
    setPurchasing(plan.tier);
    try {
      await purchaseTier(plan.tier);
      // Refresh backend subscription after successful purchase
      loadSubscription();
      Alert.alert(
        "You're all set! 🎉",
        `Welcome to ${plan.name}. Your new features are active now.`,
        [{ text: "Let's go" }],
      );
    } catch (err: unknown) {
      // Don't show an error if the user simply cancelled the sheet
      const errObj = err as { userCancelled?: boolean; message?: string };
      if (errObj?.userCancelled) return;
      Alert.alert(
        "Purchase failed",
        errObj?.message ?? "Something went wrong. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestorePurchases = async () => {
    setPurchasing("free"); // use "free" as a sentinel for restore loading state
    try {
      await restorePurchases();
      loadSubscription();
      Alert.alert("Purchases restored", "Your subscription has been restored.", [
        { text: "OK" },
      ]);
    } catch {
      Alert.alert("Restore failed", "No purchases found to restore.", [
        { text: "OK" },
      ]);
    } finally {
      setPurchasing(null);
    }
  };

  const handleManageSubscription = () => {
    Linking.openURL("itms-apps://apps.apple.com/account/subscriptions");
  };

  const handleContactSupport = () =>
    Linking.openURL("mailto:support@allteacher.app");

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <Toolbar title="Subscription" onBack={goBack} onHome={goHome} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.heroBlock}>
          <Text style={styles.heroEyebrow}>Plans & pricing</Text>
          <Text style={styles.heroTitle}>Upgrade your plan ✦</Text>
          <Text style={styles.heroSubtitle}>
            Unlock listening exercises, adaptive re-planning, and unlimited
            curricula — cancel any time.
          </Text>
        </View>

        {/* ── All plans — single card per tier; current tier marked Active ── */}
        {loading ? (
          <LoadingBlock label="Loading your plan…" />
        ) : error ? (
          <MessageBox variant="error" title="Couldn't load plan" message={error} />
        ) : (
          <>
            <Text style={styles.sectionLabel}>Plans</Text>
            {PLANS.map((plan) => {
              const planRank = TIER_RANK[plan.tier];
              const currentRank = TIER_RANK[currentTier];
              const status: CardStatus =
                planRank === currentRank
                  ? "current"
                  : planRank > currentRank
                  ? "upgrade"
                  : "downgrade";

              let meta: string | null = null;
              if (status === "current") {
                if (
                  subscription?.current_period_end &&
                  currentTier !== "free"
                ) {
                  meta = `Renews ${new Date(
                    subscription.current_period_end,
                  ).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}`;
                } else if (currentTier === "free") {
                  meta = "Free forever — upgrade any time.";
                } else {
                  meta = "Managed via App Store.";
                }
              }

              return (
                <TierCard
                  key={plan.tier}
                  plan={plan}
                  status={status}
                  meta={meta}
                  onPress={() => handleUpgrade(plan)}
                  disabled={purchasing !== null}
                  loading={purchasing === plan.tier}
                />
              );
            })}
          </>
        )}

        {/* ── Comparison table ── */}
        <Text style={styles.sectionLabel}>Feature comparison</Text>
        <View style={styles.comparisonCard}>
          {/* Header */}
          <View style={styles.comparisonHeaderRow}>
            <View style={[styles.comparisonFeatureCell, { flex: 2, backgroundColor: "transparent" }]}>
              <Text style={[styles.comparisonHeaderText, { color: colors.paper }]}>
                Feature
              </Text>
            </View>
            {(["Free", "Start.", "Pro", "Power"] as const).map((h) => (
              <View key={h} style={styles.comparisonHeaderCell}>
                <Text style={styles.comparisonHeaderText}>{h}</Text>
              </View>
            ))}
          </View>
          {/* Rows */}
          {COMPARISON_FEATURES.map((feat, i) => {
            const isLast = i === COMPARISON_FEATURES.length - 1;
            const cells: [string, string, string, string] = COMPARISON_MATRIX[feat];
            return (
              <View
                key={feat}
                style={[styles.comparisonRow, isLast && styles.comparisonRowLast]}
              >
                <View style={styles.comparisonFeatureCell}>
                  <Text style={styles.comparisonFeatureText}>{feat}</Text>
                </View>
                {cells.map((val, ci) => (
                  <View key={ci} style={styles.comparisonCheckCell}>
                    <Text
                      style={[
                        styles.comparisonCheckText,
                        {
                          color:
                            val === "✗"
                              ? colors.ink4
                              : val === "✓"
                              ? colors.ok
                              : colors.ink,
                        },
                      ]}
                    >
                      {val}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        {/* ── Bottom links ── */}
        <View style={styles.linkRow}>
          <Pressable style={styles.linkBtn} onPress={handleRestorePurchases}>
            <Text style={styles.linkText}>Restore purchases</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={handleManageSubscription}>
            <Text style={styles.linkText}>Manage subscription</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={handleContactSupport}>
            <Text style={styles.linkText}>Contact support</Text>
          </Pressable>
        </View>

        <Text style={styles.legalText}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the
          end of the current period. Manage or cancel in your App Store account
          settings. Prices shown in EUR and may vary by region.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
