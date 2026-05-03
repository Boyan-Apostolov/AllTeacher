/**
 * Subscription & Upgrade screen — shows the user's current plan and lets
 * them upgrade to Pro or Power. Upgrade buttons are active (tappable with
 * feedback) but not connected to RevenueCat / Apple IAP yet.
 * That wiring lands in step 7b.
 */
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "free" | "pro" | "power";

interface TierFeature {
  text: string;
  tiers: Tier[]; // which tiers include this feature
}

// ─── Static plan data ─────────────────────────────────────────────────────────

const FEATURES: TierFeature[] = [
  { text: "1 active curriculum",          tiers: ["free"] },
  { text: "Up to 3 curricula",             tiers: ["pro", "power"] },
  { text: "Unlimited curricula",           tiers: ["power"] },
  { text: "Assessor + weekly planner",     tiers: ["free", "pro", "power"] },
  { text: "Lessons + exercises",           tiers: ["free", "pro", "power"] },
  { text: "Streaming feedback",            tiers: ["free", "pro", "power"] },
  { text: "Listening exercises (TTS)",     tiers: ["pro", "power"] },
  { text: "Visual lessons (diagrams)",     tiers: ["free", "pro", "power"] },
  { text: "Adaptive re-planner",           tiers: ["pro", "power"] },
  { text: "Make it harder / Add sessions", tiers: ["pro", "power"] },
  { text: "Vocabulary bank",               tiers: ["free", "pro", "power"] },
  { text: "Priority AI (faster models)",   tiers: ["power"] },
];

const COMPARISON_FEATURES = [
  "Curricula",
  "Lessons & exercises",
  "Listening exercises",
  "Adaptive re-planner",
  "Vocabulary bank",
  "Priority AI",
];
const COMPARISON_MATRIX: Record<string, [string, string, string]> = {
  "Curricula":              ["1",  "3",  "∞"],
  "Lessons & exercises":    ["✓",  "✓",  "✓"],
  "Listening exercises":    ["✗",  "✓",  "✓"],
  "Adaptive re-planner":    ["✗",  "✓",  "✓"],
  "Vocabulary bank":        ["✓",  "✓",  "✓"],
  "Priority AI":            ["✗",  "✗",  "✓"],
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
    tier: "pro",
    emoji: "✦",
    name: "Pro",
    price: "€7.99",
    pricePer: "/ month",
    tagline: "Serious learners — multiple goals, listening drills, adaptive re-plans.",
    color: colors.brand,
    features: [
      "Up to 3 curricula",
      "Everything in Free",
      "Listening exercises (TTS audio)",
      "Adaptive re-planner",
      "Make it harder / Add sessions",
    ],
  },
  {
    tier: "power",
    emoji: "⚡",
    name: "Power",
    price: "€14.99",
    pricePer: "/ month",
    tagline: "Unlimited everything — fastest models, no caps, no limits.",
    color: colors.mc,
    features: [
      "Unlimited curricula",
      "Everything in Pro",
      "Priority AI (faster models)",
      "Early access to new features",
    ],
  },
];

// Tier rank — used to filter out lower/equal plans
const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, power: 2 };

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierCard({
  plan,
  onUpgrade,
}: {
  plan: PlanDef;
  onUpgrade: () => void;
}) {
  return (
    <View style={styles.tierCard}>
      {/* Header */}
      <View style={styles.tierHeader}>
        <View style={styles.tierHeaderRow}>
          <Text style={styles.tierEmoji}>{plan.emoji}</Text>
          <View style={styles.tierPriceBlock}>
            <Text style={styles.tierPrice}>{plan.price}</Text>
            <Text style={styles.tierPricePer}>{plan.pricePer}</Text>
          </View>
        </View>
        <Text style={styles.tierName}>{plan.name}</Text>
        <Text style={styles.tierTagline}>{plan.tagline}</Text>
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
      <Pressable
        style={[styles.upgradeBtn, { backgroundColor: plan.color }]}
        onPress={onUpgrade}
      >
        <Text style={styles.upgradeBtnText}>Upgrade to {plan.name} →</Text>
      </Pressable>
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

  const currentPlan = PLANS.find((p) => p.tier === currentTier) ?? PLANS[0];

  const handleUpgrade = (plan: PlanDef) => {
    Alert.alert(
      `Upgrade to ${plan.name}`,
      `In-app purchase via Apple IAP — coming soon!\n\nPrice: ${plan.price}${plan.pricePer}`,
      [{ text: "OK" }],
    );
  };

  const handleRestorePurchases = () =>
    Alert.alert("Restore purchases", "Apple IAP restore — coming soon!");

  const handleManageSubscription = () =>
    Alert.alert(
      "Manage subscription",
      "Opens App Store subscription management — coming soon!",
    );

  const handleContactSupport = () =>
    Alert.alert("Contact support", "Support email — coming soon!");

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

        {/* ── Current plan ── */}
        {loading ? (
          <LoadingBlock label="Loading your plan…" />
        ) : error ? (
          <MessageBox variant="error" title="Couldn't load plan" message={error} />
        ) : (
          <View
            style={[
              styles.currentCard,
              { backgroundColor: currentPlan.color + "14" },
            ]}
          >
            <Text style={styles.currentLabel}>Your current plan</Text>
            <View style={styles.currentRow}>
              <Text style={styles.currentTierName}>
                {currentPlan.emoji} {currentPlan.name}
              </Text>
              <View
                style={[
                  styles.currentBadge,
                  { backgroundColor: currentPlan.color },
                ]}
              >
                <Text style={styles.currentBadgeText}>Active</Text>
              </View>
            </View>
            {subscription?.current_period_end && currentTier !== "free" ? (
              <Text style={styles.currentMeta}>
                Renews{" "}
                {new Date(subscription.current_period_end).toLocaleDateString(
                  undefined,
                  { month: "long", day: "numeric", year: "numeric" },
                )}
              </Text>
            ) : (
              <Text style={styles.currentMeta}>
                {currentTier === "free"
                  ? "Free forever — upgrade any time."
                  : "Managed via App Store."}
              </Text>
            )}
          </View>
        )}

        {/* ── Upgrade options — only plans ranked above the current tier ── */}
        {PLANS.filter((p) => TIER_RANK[p.tier] > TIER_RANK[currentTier]).length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Upgrade options</Text>
            {PLANS.filter((p) => TIER_RANK[p.tier] > TIER_RANK[currentTier]).map((plan) => (
              <TierCard
                key={plan.tier}
                plan={plan}
                onUpgrade={() => handleUpgrade(plan)}
              />
            ))}
          </>
        ) : (
          <View style={styles.topPlanBanner}>
            <Text style={styles.topPlanEmoji}>⚡</Text>
            <Text style={styles.topPlanTitle}>You're on our best plan</Text>
            <Text style={styles.topPlanBody}>
              Power gives you unlimited curricula, priority AI, and every feature
              we ship. Nothing left to unlock.
            </Text>
          </View>
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
            {(["Free", "Pro", "Power"] as const).map((h) => (
              <View key={h} style={styles.comparisonHeaderCell}>
                <Text style={styles.comparisonHeaderText}>{h}</Text>
              </View>
            ))}
          </View>
          {/* Rows */}
          {COMPARISON_FEATURES.map((feat, i) => {
            const isLast = i === COMPARISON_FEATURES.length - 1;
            const cells = COMPARISON_MATRIX[feat];
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
