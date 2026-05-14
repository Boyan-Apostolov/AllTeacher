import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import {
  api,
  BASE_URL,
  type CurriculumListItem,
  type HealthResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, radii, shadow, spacing, type } from "@/lib/theme";
import { Gradient } from "@/components/Gradient";

const greetings = ["Hey", "Welcome back", "Ready to learn?"];

function pickGreeting(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return greetings[h % greetings.length];
}

export default function Home() {
  const router = useRouter();
  const { user, session, signOut } = useAuth();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [meOk, setMeOk] = useState<boolean | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [curricula, setCurricula] = useState<CurriculumListItem[] | null>(null);
  const [curriculaError, setCurriculaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => !cancelled && setHealth(h))
      .catch((e: Error) => !cancelled && setHealthError(e.message));
    if (session?.access_token) {
      api
        .me(session.access_token)
        .then(() => !cancelled && setMeOk(true))
        .catch((e: Error) => {
          if (cancelled) return;
          setMeOk(false);
          setMeError(e.message);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.access_token) return;
      let cancelled = false;
      setCurriculaError(null);
      api
        .listCurricula(session.access_token)
        .then((res) => !cancelled && setCurricula(res.curricula))
        .catch((e: Error) => !cancelled && setCurriculaError(e.message));
      return () => {
        cancelled = true;
      };
    }, [session?.access_token]),
  );

  const removeCurriculum = (c: CurriculumListItem) => {
    if (!session?.access_token) return;
    const token = session.access_token;
    const label = c.goal || c.topic || "this curriculum";
    Alert.alert(
      "Remove curriculum?",
      `“${label}” and all its data will be deleted. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setCurricula((prev) =>
              prev ? prev.filter((x) => x.id !== c.id) : prev,
            );
            try {
              await api.deleteCurriculum(token, c.id);
            } catch (e) {
              setCurriculaError((e as Error).message);
              try {
                const res = await api.listCurricula(token);
                setCurricula(res.curricula);
              } catch {
                /* ignore */
              }
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
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <Gradient
          from={colors.brand}
          via={colors.accent}
          to={colors.brandDeep}
          angle={140}
          style={styles.hero}
        >
          <Text style={styles.heroEyebrow}>AllTeacher</Text>
          <Text style={styles.heroTitle}>
            {greeting}, {firstName} 👋
          </Text>
          <Text style={styles.heroSubtitle}>
            Pick up where you left off, or start something new.
          </Text>
          <Pressable
            style={styles.heroCta}
            onPress={() => router.push("/curriculum/new")}
          >
            <Text style={styles.heroCtaText}>+ Start something new</Text>
          </Pressable>
        </Gradient>

        {/* Curricula */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionLabel}>Your curricula</Text>

          {curriculaError ? (
            <View style={[styles.card, styles.cardDanger]}>
              <Text style={type.body}>{curriculaError}</Text>
            </View>
          ) : curricula === null ? (
            <View style={styles.card}>
              <ActivityIndicator color={colors.brand} />
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

        {/* Diagnostics — collapsed bottom strip */}
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Text style={styles.sectionLabel}>Diagnostics</Text>
          <View style={styles.diagRow}>
            <DiagPill ok={!healthError && !!health} label="API" />
            <DiagPill ok={meOk === true} label="JWT" />
            <DiagPill
              ok={!!health?.configured.openai}
              label="OpenAI"
            />
            <DiagPill
              ok={!!health?.configured.supabase}
              label="Supabase"
            />
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

function curriculumProgress(c: CurriculumListItem): {
  pct: number;
  stepLabel: string;
  barColor: string;
} {
  // Once the plan is generated, "progress" means: how many sessions have
  // been completed out of how many sessions there are. A session = one
  // curriculum_weeks row, and is "complete" when every exercise in it has
  // been evaluated. The backend rolls these counts up into the list payload.
  if (c.planner_status === "complete") {
    const total = c.sessions_total ?? 0;
    const done = c.sessions_completed ?? 0;
    if (total > 0) {
      const pct = Math.max(0, Math.min(1, done / total));
      const all = done >= total;
      const stepLabel = all
        ? `All ${total} sessions complete 🎉`
        : `${done} of ${total} sessions · ${Math.round(pct * 100)}%`;
      const barColor = all
        ? colors.success
        : done > 0
          ? colors.brand
          : colors.textFaint;
      return { pct: all ? 1 : Math.max(pct, 0.04), stepLabel, barColor };
    }
    // Plan ready but no week rows — show "ready to learn" rather than 100%.
    return {
      pct: 0.04,
      stepLabel: "Plan ready · start your first session",
      barColor: colors.brand,
    };
  }
  if (c.assessor_status === "complete") {
    return { pct: 0.66, stepLabel: "Step 2/3 · generate your plan", barColor: colors.brand };
  }
  if (c.assessor_status === "in_progress") {
    return { pct: 0.33, stepLabel: "Step 1/3 · assessment in progress", barColor: colors.warning };
  }
  return { pct: 0.05, stepLabel: "Step 1/3 · start assessment", barColor: colors.textFaint };
}

function CurriculumRow({
  item,
  onOpen,
  onRemove,
}: {
  item: CurriculumListItem;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { badge, badgeBg, badgeFg } = statusBadge(item);
  const emoji = domainEmoji(item.domain);
  const { pct, stepLabel, barColor } = curriculumProgress(item);

  return (
    <View style={[styles.curriculumRow, shadow.card]}>
      <Pressable style={styles.curriculumBody} onPress={onOpen}>
        {/* Top row: icon + title + badge */}
        <View style={styles.curriculumTopRow}>
          <View style={styles.curriculumIcon}>
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.curriculumTitle} numberOfLines={2}>
              {item.goal || item.topic || "Untitled"}
            </Text>
            <View style={styles.curriculumMetaRow}>
              <View
                style={[styles.statusBadge, { backgroundColor: badgeBg }]}
              >
                <Text style={[styles.statusBadgeText, { color: badgeFg }]}>
                  {badge}
                </Text>
              </View>
              {item.level ? (
                <Text style={styles.curriculumMeta}>· {item.level}</Text>
              ) : null}
              {item.domain ? (
                <Text style={styles.curriculumMeta}>· {item.domain}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Progress bar + stats */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressStepLabel}>{stepLabel}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${pct * 100}%` as any, backgroundColor: barColor },
              ]}
            />
          </View>
        </View>
      </Pressable>

      <Pressable
        style={styles.removeBtn}
        onPress={onRemove}
        hitSlop={8}
        accessibilityLabel="Remove curriculum"
      >
        <Text style={styles.removeBtnText}>×</Text>
      </Pressable>
    </View>
  );
}

function DiagPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View
      style={[
        styles.diagPill,
        { backgroundColor: ok ? colors.successSoft : colors.dangerSoft },
      ]}
    >
      <Text style={{ fontSize: 11 }}>{ok ? "✓" : "—"}</Text>
      <Text
        style={[
          styles.diagPillText,
          { color: ok ? "#15803d" : colors.danger },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function statusBadge(c: CurriculumListItem) {
  if (c.planner_status === "complete") {
    return { badge: "Plan ready", badgeBg: colors.successSoft, badgeFg: "#15803d" };
  }
  if (c.assessor_status === "complete") {
    return {
      badge: "Ready to plan",
      badgeBg: colors.brandSoft,
      badgeFg: colors.brandDeep,
    };
  }
  if (c.assessor_status === "in_progress") {
    return {
      badge: "Assessing…",
      badgeBg: colors.warningSoft,
      badgeFg: "#a16207",
    };
  }
  return { badge: "New", badgeBg: colors.surfaceMuted, badgeFg: colors.textMuted };
}

function domainEmoji(domain: string | null): string {
  switch (domain) {
    case "language":
      return "🗣️";
    case "code":
      return "💻";
    case "music":
      return "🎵";
    case "academic":
      return "📚";
    case "creative":
      return "🎨";
    case "fitness":
      return "💪";
    case "professional":
      return "💼";
    default:
      return "✨";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Text that sits directly on the dark bg (not inside a card)
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffffaa",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // Hero
  hero: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    overflow: "hidden",
  },
  heroEyebrow: {
    color: "#ffffffcc",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.textOnDark,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: "#ffffffcc",
    fontSize: 15,
    marginBottom: spacing.md,
  },
  heroCta: {
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
    ...shadow.raised,
  },
  heroCtaText: {
    color: colors.brandDeep,
    fontSize: 15,
    fontWeight: "700",
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  emptyCard: {
    alignItems: "flex-start",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyEmoji: { fontSize: 36 },
  emptyCta: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  emptyCtaText: { color: "#fff", fontWeight: "700" },

  // Curriculum row
  curriculumRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  curriculumBody: {
    flex: 1,
    flexDirection: "column",
    padding: spacing.md,
    gap: spacing.sm,
  },
  curriculumTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  curriculumIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  curriculumTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  curriculumMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  curriculumMeta: { fontSize: 12, color: colors.textMuted },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },

  // Progress bar
  progressSection: {
    gap: 5,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressStepLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "500",
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.pill,
  },

  removeBtn: {
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    backgroundColor: colors.dangerSoft,
  },
  removeBtnText: { fontSize: 22, color: colors.danger, fontWeight: "700" },

  // Diagnostics
  diagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  diagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  diagPillText: { fontSize: 12, fontWeight: "700" },
  diagDetail: { fontSize: 11, color: "#ffffff55" },
  diagError: { fontSize: 11, color: colors.danger },

  // Sign out
  signOut: {
    marginTop: spacing.md,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#ffffff22",
    backgroundColor: "#ffffff0f",
  },
  signOutText: { fontSize: 14, color: "#ffffffaa", fontWeight: "600" },
});
