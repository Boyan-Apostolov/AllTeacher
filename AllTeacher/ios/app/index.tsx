/**
 * Home screen — neo-brutalist redesign.
 * Streak hero card, today's session, curriculum list, diagnostics.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
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
import { LoadingBlock, MessageBox, PrimaryCta } from "@/components/ui";
import { Sticker } from "@/components/ui/Sticker";
import { Spark } from "@/components/ui/Spark";
import { pickGreeting } from "@/lib/curriculum";
import { colors, spacing, type } from "@/lib/theme";

import { homeStyles as styles } from "./index.styles";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function TierBadge({ subscription }: { subscription: Subscription | null }) {
  if (!subscription) return null;
  const tier = subscription.effective_tier ?? subscription.tier;
  if (tier === "free") return null;
  const label = tier === "power" ? "⚡ Power" : "✦ Pro";
  const expiry = subscription.current_period_end;
  const expiryText = expiry
    ? `until ${new Date(expiry).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : null;
  return (
    <Sticker bg={tier === "power" ? colors.mc : colors.brand} color="#fff" rotate={2} style={{ marginTop: 4 }} uppercase={false}>
      {label}{expiryText ? ` · ${expiryText}` : ""}
    </Sticker>
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
  const [refreshing, setRefreshing] = useState(false);

  const userId = user?.id ?? session?.user?.id;
  const ckCurricula = userId ? `home:${userId}:curricula` : null;
  const ckSubscription = userId ? `home:${userId}:subscription` : null;

  useEffect(() => {
    if (!session?.access_token || !userId) return;
    const token = session.access_token;
    let cancelled = false;

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

    (async () => {
      if (ckCurricula) {
        const cached = await cacheGet<CurriculumListItem[]>(ckCurricula);
        if (!cancelled && cached) setCurricula(cached);
      }
      if (ckSubscription) {
        const cached = await cacheGet<Subscription>(ckSubscription);
        if (!cancelled && cached) setSubscription(cached);
      }
      const hasCurriculaCache = ckCurricula ? !!(await cacheGet(ckCurricula)) : false;
      if (!hasCurriculaCache) await fetchCurricula(token, false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, userId]);

  const fetchCurricula = useCallback(
    async (token: string, _bust: boolean) => {
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
      } catch { setSubscription(null); }
    },
    [ckSubscription],
  );

  const onRefresh = useCallback(async () => {
    if (!session?.access_token) return;
    setRefreshing(true);
    await Promise.all([
      fetchCurricula(session.access_token, true),
      fetchSubscription(session.access_token),
    ]);
    setRefreshing(false);
  }, [session?.access_token, fetchCurricula, fetchSubscription]);

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
            setCurricula((prev) => prev ? prev.filter((x) => x.id !== c.id) : prev);
            try {
              await api.deleteCurriculum(token, c.id);
              if (ckCurricula) await cacheDel(ckCurricula);
            } catch (e) {
              setCurriculaError((e as Error).message);
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

  const firstName = (user?.email?.split("@")[0] ?? "").replace(/[^a-zA-Z]/g, "") || "there";
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayDow = new Date().getDay(); // 0=Sun
  // Derive a rough streak number from active curricula (visual only — real streak logic is backend)
  const streakDays = curricula && curricula.length > 0 ? 7 : 0;
  const activeCurriculum = curricula && curricula.length > 0 ? curricula[0] : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerDay}>{dayName}</Text>
            <Text style={styles.headerName}>Hey, {firstName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName[0]?.toUpperCase() ?? "?"}</Text>
          </View>
        </View>

        {/* ── Streak hero ── */}
        {streakDays > 0 ? (
          <View style={styles.streakCard}>
            <View style={styles.streakTop}>
              <View style={{ position: "relative" }}>
                <View style={styles.streakBadge}>
                  <Text style={styles.streakBadgeNum}>{streakDays}</Text>
                </View>
                <View style={{ position: "absolute", top: -8, right: -8 }}>
                  <Spark size={20} color="#FFE066" />
                </View>
              </View>
              <View style={styles.streakInfo}>
                <Text style={styles.streakTitle}>day streak.</Text>
                <Text style={styles.streakSub}>Keep it going — you're on a roll.</Text>
              </View>
            </View>
            {/* Day dots */}
            <View style={styles.streakDots}>
              {DAYS.map((d, i) => {
                const done = i < 5;
                return (
                  <View key={i} style={styles.streakDotWrap}>
                    <View style={[styles.streakDotBox, done ? styles.streakDotFilled : styles.streakDotEmpty]}>
                      {done ? <Text style={styles.streakDotText}>✓</Text> : null}
                    </View>
                    <Text style={styles.streakDotLabel}>{d}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ── Tier badge ── */}
        <TierBadge subscription={subscription} />

        {/* ── Today ── */}
        {activeCurriculum ? (
          <View>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Today</Text>
              <Text style={styles.sectionMeta}>~15 min</Text>
            </View>
            <View style={[styles.todayCard, { marginTop: 10 }]}>
              <View style={styles.todayCardTop}>
                <View style={styles.todayEmoji}>
                  <Text style={styles.todayEmojiText}>📚</Text>
                </View>
                <View style={styles.todayInfo}>
                  <Sticker bg={colors.flashSoft} color={colors.ink} rotate={-2} style={{ paddingVertical: 3, paddingHorizontal: 7 }} textStyle={{ fontSize: 9 }} uppercase={false}>
                    {activeCurriculum.goal?.slice(0, 20) ?? "Curriculum"}
                  </Sticker>
                  <Text style={styles.todayTitle} numberOfLines={2}>
                    {activeCurriculum.goal || activeCurriculum.topic}
                  </Text>
                  <Text style={styles.todaySub}>Lesson · exercises</Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: "40%" }]} />
              </View>
              <View style={{ marginTop: 12 }}>
                <PrimaryCta
                  label="Continue learning →"
                  onPress={() => router.push(`/curriculum/${activeCurriculum.id}`)}
                  bg={colors.brand}
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* ── All curricula ── */}
        <View>
          <Text style={styles.sectionLabel}>
            {activeCurriculum ? "Also brewing" : "Your curricula"}
          </Text>
          <View style={{ marginTop: 10, gap: 10 }}>
            {curriculaError ? (
              <MessageBox variant="error" message={curriculaError} />
            ) : curricula === null ? (
              <View style={styles.card}>
                <LoadingBlock light={false} />
              </View>
            ) : curricula.length === 0 ? (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={styles.emptyEmoji}>🌱</Text>
                <Text style={type.h1}>No curricula yet</Text>
                <Text style={type.bodyMuted}>
                  Tell AllTeacher what you want to learn — anything from conversational Italian to drumming or calculus.
                </Text>
                <Pressable
                  style={styles.emptyCta}
                  onPress={() => router.push("/curriculum/new")}
                >
                  <Text style={styles.emptyCtaText}>Choose a goal →</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {curricula.slice(activeCurriculum ? 1 : 0).map((c) => (
                  <CurriculumRow
                    key={c.id}
                    item={c}
                    onOpen={() => router.push(`/curriculum/${c.id}`)}
                    onRemove={() => removeCurriculum(c)}
                  />
                ))}
                <Pressable
                  style={styles.emptyDash}
                  onPress={() => router.push("/curriculum/new")}
                >
                  <Text style={styles.emptyDashText}>+ New curriculum</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* ── Admin + Progress CTAs ── */}
        <View style={styles.heroCtaRow}>
          <Pressable style={styles.heroCtaGhost} onPress={() => router.push("/progress")}>
            <Text style={styles.heroCtaGhostText}>📈 Progress</Text>
          </Pressable>
          {isAdmin ? (
            <Pressable style={styles.heroCtaGhost} onPress={() => router.push("/admin")}>
              <Text style={styles.heroCtaGhostText}>🛠 Admin</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ── Diagnostics ── */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionLabel}>Diagnostics</Text>
          <View style={styles.diagRow}>
            <DiagPill ok={!healthError && !!health} label="API" />
            <DiagPill ok={meOk === true} label="JWT" />
            <DiagPill ok={!!health?.configured.openai} label="OpenAI" />
            <DiagPill ok={!!health?.configured.supabase} label="Supabase" />
          </View>
          <Text style={styles.diagDetail}>{BASE_URL}</Text>
          {healthError ? <Text style={styles.diagError}>{healthError}</Text> : null}
          {meError ? <Text style={styles.diagError}>{meError}</Text> : null}
        </View>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
