/**
 * Global progress dashboard — streak, totals, weak areas / strengths and a
 * per-curriculum drill-down list. Pure orchestration; rendering lives in
 * `components/progress/` and `components/ui/`.
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { api, type DashboardSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  MetricGrid,
  StreakCard,
  TagList,
  type Metric,
} from "@/components/progress";
import {
  LoadingBlock,
  MessageBox,
  ScreenContainer,
  Toolbar,
} from "@/components/ui";
import {
  domainEmoji,
  formatRelative,
  formatScorePct,
} from "@/lib/curriculum";

import { progressScreenStyles as styles } from "./progress.styles";

function buildTotals(summary: DashboardSummary): Metric[] {
  const t = summary.totals;
  const avg = t.avg_score === null ? "—" : formatScorePct(t.avg_score);
  return [
    {
      label: "Sessions",
      value: `${t.sessions_completed}/${t.sessions_total}`,
      hint: t.sessions_total === 0 ? "Not started" : "completed",
    },
    {
      label: "Exercises",
      value: `${t.exercises_completed}/${t.exercises_total}`,
      hint: t.exercises_total === 0 ? "Not started" : "evaluated",
    },
    {
      label: "Avg score",
      value: avg,
      hint: t.avg_score === null ? "—" : "across all answers",
    },
    {
      label: "Curricula",
      value: String(t.curricula),
      hint: t.curricula === 1 ? "in flight" : "in flight",
    },
  ];
}

export default function ProgressDashboard() {
  const router = useRouter();
  const { session } = useAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!session?.access_token) return;
      let cancelled = false;
      const token = session.access_token;
      setError(null);
      setLoading(true);
      api
        .getDashboard(token)
        .then((res) => {
          if (cancelled) return;
          setSummary(res);
          setLoading(false);
        })
        .catch((e: Error) => {
          if (cancelled) return;
          setError(e.message);
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [session?.access_token]),
  );

  const goHome = () => router.replace("/");
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <Toolbar title="Progress" onBack={goBack} onHome={goHome} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.heroEyebrow}>Your dashboard</Text>
          <Text style={styles.heroTitle}>
            {summary && summary.streak.current_days > 0
              ? `${summary.streak.current_days}-day streak 🔥`
              : "Let's keep moving."}
          </Text>
          <Text style={styles.heroSubtitle}>
            Activity, focus areas and per-curriculum progress, all in one place.
          </Text>
        </View>

        {error ? (
          <MessageBox
            variant="error"
            title="Couldn't load progress"
            message={error}
          />
        ) : null}

        {loading || !summary ? (
          <LoadingBlock label="Loading progress…" />
        ) : (
          <>
            <StreakCard
              streak={summary.streak}
              activity={summary.activity}
            />

            <MetricGrid metrics={buildTotals(summary)} />

            <TagList variant="weak" tags={summary.top_weak_areas} />
            <TagList variant="strength" tags={summary.top_strengths} />

            <View style={styles.curriculumCard}>
              <Text style={styles.sectionLabel}>Per-curriculum</Text>
              {summary.curricula.length === 0 ? (
                <Text style={styles.empty}>
                  No active curricula yet — start one from home.
                </Text>
              ) : (
                summary.curricula.map((c, idx) => {
                  const isLast = idx === summary.curricula.length - 1;
                  const title =
                    c.goal || c.topic || c.domain || "Untitled course";
                  const sessionPart =
                    c.sessions_total > 0
                      ? `${c.sessions_completed}/${c.sessions_total} sessions`
                      : "not started";
                  const week =
                    c.current_week !== null && c.current_week > 0
                      ? `wk ${c.current_week}`
                      : "wk —";
                  const lastActive = c.last_active_at
                    ? formatRelative(c.last_active_at)
                    : "no activity yet";
                  return (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.curriculumRow,
                        isLast && styles.curriculumRowLast,
                      ]}
                      onPress={() => router.push(`/curriculum/${c.id}`)}
                    >
                      <Text style={styles.curriculumEmoji}>
                        {domainEmoji(c.domain)}
                      </Text>
                      <View style={styles.curriculumBody}>
                        <Text
                          style={styles.curriculumTitle}
                          numberOfLines={1}
                        >
                          {title}
                        </Text>
                        <Text
                          style={styles.curriculumMeta}
                          numberOfLines={1}
                        >
                          {`${week} · ${sessionPart} · ${lastActive}`}
                        </Text>
                      </View>
                      <Text style={styles.curriculumScore}>
                        {c.avg_score === null
                          ? "—"
                          : formatScorePct(c.avg_score)}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            {/* Tiny hint so the curriculum-level dashboard is discoverable. */}
            <View style={styles.tipCard}>
              <Text style={styles.tipLabel}>Tip</Text>
              <Text style={styles.tipText}>
                Tap any curriculum to open its plan and per-week progress.
              </Text>
            </View>

          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
