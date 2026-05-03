/**
 * Home screen — pure orchestration. Owns the data fetches and the
 * navigation; rendering is delegated to components in `components/home/`
 * and the shared `components/ui/` primitives.
 *
 * Caching strategy: cache-first, pull-to-refresh.
 *   • Cached curricula + subscription are shown instantly on mount.
 *   • No automatic background refresh on focus — swipe-down only.
 *   • Cache is invalidated by session.tsx after a session finishes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  api,
  BASE_URL,
  type CurriculumListItem,
  type HealthResponse,
  type Subscription,
} from "@/lib/api";
import { useAuth, useAdmin } from "@/lib/auth";
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache";
import { CurriculumRow, DiagPill } from "@/components/home";
import { LoadingBlock, MessageBox } from "@/components/ui";
import { Gradient } from "@/components/Gradient";
import { pickGreeting } from "@/lib/curriculum";
import { colors, spacing, type } from "@/lib/theme";

import { homeStyles as styles } from "./index.styles";

function TierBadge({ subscription }: { subscription: Subscription | null }) {
  if (!subscription) return null;
  const tier = subscription.effective_tier ?? subscription.tier;
  const label =
    tier === "power" ? "Power" : tier === "pro" ? "Pro" : "Free";
  const expiry = subscription.current_period_end;
  const expiryText =
    tier !== "free" && expiry
      ? `until ${new Date(expiry).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}`
      : null;
  return (
    <View style={styles.tierBadge}>
      <View style={styles.tierBadgeDot} />
      <Text style={styles.tierBadgeText}>{label}</Text>
      {expiryText ? (
        <Text style={styles.tierBadgeMeta}>· {expiryText}</Text>
      ) : null}
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, session, signOut } = useAuth();
  const isAdmin = useAdmin();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [meOk, setMeOk] = useState<boolean | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [curricula, setCurricula] = useState<CurriculumListItem[] | null>(null);
  const [curriculaError, setCurriculaError] = useState<string | null>(null);

  const [subscription, setSubscription] = useState<Subscription | null>(null);

  // true only during an explicit pull-to-refresh — NOT on initial mount.
  const [refreshing, setRefreshing] = useState(false);

  const userId = user?.id ?? session?.user?.id;

  // Cache keys scoped to the user so switching accounts doesn't bleed data.
  const ckCurricula   = userId ? `home:${userId}:curricula`    : null;
  const ckSubscription = userId ? `home:${userId}:subscription` : null;

  // ── Initial mount: hydrate from cache then fetch diagnostics ──────────
  useEffect(() => {
    if (!session?.access_token || !userId) return;
    const token = session.access_token;
    let cancelled = false;

    // Health + /me are cheap diagnostics — always fetch fresh.
    api.health()
      .then((h) => { if (!cancelled) setHealth(h); })
      .catch((e: Error) => { if (!cancelled) setHealthError(e.message); });
    api.me(token)
      .then(() => { if (!cancelled) setMeOk(true); })
      .catch((e: Error) => {
        if (cancelled) return;
        setMeOk(false);
        setMeError(e.message);
      });

    // Curricula + subscription: show cache instantly, then load from API
    // only if we have nothing yet (first run or cache cleared).
    (async () => {
      if (ckCurricula) {
        const cached = await cacheGet<CurriculumListItem[]>(ckCurricula);
        if (!cancelled && cached) setCurricula(cached);
      }
      if (ckSubscription) {
        const cached = await cacheGet<Subscription>(ckSubscription);
        if (!cancelled && cached) setSubscription(cached);
      }

      // Only hit the API if we didn't have cached data.
      const hasCurriculaCache = ckCurricula
        ? !!(await cacheGet(ckCurricula))
        : false;

      if (!hasCurriculaCache) {
        await fetchCurricula(token, false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, userId]);

  // ── Data fetchers ──────────────────────────────────────────────────────
  const fetchCurricula = useCallback(
    async (token: string, bust: boolean) => {
      setCurriculaError(null);
      try {
        const res = await api.listCurricula(token);
        setCurricula(res.curricula);
        if (ckCurricula) await cacheSet(ckCurricula, res.curricula);
      } catch (e: any) {
        setCurriculaError((e as Error).message);
      }
    },
    [ckCurricula],
  );

  const fetchSubscription = useCallback(
    async (token: string) => {
      try {
        const s = await api.mySubscription(token);
        setSubscription(s);
        if (ckSubscription) await cacheSet(ckSubscription, s);
      } catch {
        setSubscription(null);
      }
    },
    [ckSubscription],
  );

  // ── Pull-to-refresh ────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    if (!session?.access_token) return;
    setRefreshing(true);
    const token = session.access_token;
    await Promise.all([
      fetchCurricula(token, true),
      fetchSubscription(token),
    ]);
    setRefreshing(false);
  }, [session?.access_token, fetchCurricula, fetchSubscription]);

  // ── Mutations ──────────────────────────────────────────────────────────
  const removeCurriculum = (c: CurriculumListItem) => {
    if (!session?.access_token) return;
    const token = session.access_token;
    const label = c.goal || c.topic || "this curriculum";
    Alert.alert(
      "Remove curriculum?",
      `"${label}" and all its data will be deleted. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            // Optimistic update.
            setCurricula((prev) =>
              prev ? prev.filter((x) => x.id !== c.id) : prev,
            );
            try {
              await api.deleteCurriculum(token, c.id);
              // Bust cache so the removed item doesn't reappear on next cold open.
              if (ckCurricula) await cacheDel(ckCurricula);
            } catch (e) {
              setCurriculaError((e as Error).message);
              // Revert optimistic update.
              try {
                const res = await api.listCurricula(token);
                setCurricula(res.curricula);
                if (ckCurricula) await cacheSet(ckCurricula, res.curricula);
              } catch { /* ignore */ }
            }
          },
        },
      ],
    );
  };

  const greeting = pickGreeting(user?.email ?? "x");
  const firstName = user?.email?.split("@")[0] ?? "";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
      >
        {/* Hero */}
        <Gradient
          from={colors.brand}
          via={colors.accent}
          to={colors.brandDeep}
          angle={140}
          style={styles.hero}
        >
          <View style={styles.tierBadgeRow}>
            <Text style={styles.heroEyebrow}>AllTeacher</Text>
            <TierBadge subscription={subscription} />
          </View>
          <Text style={styles.heroTitle}>
            {greeting}, {firstName} 👋
          </Text>
          <Text style={styles.heroSubtitle}>
            Pick up where you left off, or start something new.
          </Text>
          <View style={styles.heroCtaRow}>
            <Pressable
              style={styles.heroCta}
              onPress={() => router.push("/curriculum/new")}
            >
              <Text style={styles.heroCtaText}>+ Start something new</Text>
            </Pressable>
            <Pressable
              style={styles.heroCtaGhost}
              onPress={() => router.push("/progress")}
            >
              <Text style={styles.heroCtaGhostText}>📈 Progress</Text>
            </Pressable>
            {isAdmin ? (
              <Pressable
                style={styles.heroCtaGhost}
                onPress={() => router.push("/admin")}
              >
                <Text style={styles.heroCtaGhostText}>🛠 Admin</Text>
              </Pressable>
            ) : null}
          </View>
        </Gradient>

        {/* Curricula */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionLabel}>Your curricula</Text>

          {curriculaError ? (
            <MessageBox variant="error" message={curriculaError} />
          ) : curricula === null ? (
            <View style={styles.card}>
              <LoadingBlock light={false} />
            </View>
          ) : curricula.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={type.h3}>No curricula yet</Text>
              <Text style={type.bodyMuted}>
                Tell AllTeacher what you want to learn — anything from
                conversational Italian to drumming or React. The Assessor
                will tailor a plan to your level and the time you've got.
              </Text>
              <Pressable
                style={styles.emptyCta}
                onPress={() => router.push("/curriculum/new")}
              >
                <Text style={styles.emptyCtaText}>Choose a goal →</Text>
              </Pressable>
            </View>
          ) : (
            curricula.map((c) => (
              <CurriculumRow
                key={c.id}
                item={c}
                onOpen={() => router.push(`/curriculum/${c.id}`)}
                onRemove={() => removeCurriculum(c)}
              />
            ))
          )}
        </View>

        {/* Diagnostics */}
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Text style={styles.sectionLabel}>Diagnostics</Text>
          <View style={styles.diagRow}>
            <DiagPill ok={!healthError && !!health} label="API" />
            <DiagPill ok={meOk === true} label="JWT" />
            <DiagPill ok={!!health?.configured.openai} label="OpenAI" />
            <DiagPill ok={!!health?.configured.supabase} label="Supabase" />
          </View>
          <Text style={styles.diagDetail}>{BASE_URL}</Text>
          {healthError ? (
            <Text style={styles.diagError}>{healthError}</Text>
          ) : null}
          {meError ? <Text style={styles.diagError}>{meError}</Text> : null}
        </View>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
