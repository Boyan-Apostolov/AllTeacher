/**
 * Curriculum detail screen — pure orchestration. Drives three sequential
 * states for one row:
 *   1. Assessor MCQ loop  (assessor_status != 'complete')
 *   2. Assessment summary + "Generate plan" CTA
 *   3. Plan view: title, summary, phases, week cards
 *
 * Caching strategy: cache-first, pull-to-refresh.
 *   • getCurriculum / getWeeks / getCurriculumProgress are cached.
 *   • useFocusEffect auto-refresh removed — swipe-down only.
 *   • session.tsx invalidates the cache prefix when a session finishes.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  api,
  type AssessorQuestion,
  type AssessorStepResponse,
  type AssessorSummary,
  type CurriculumProgressDetail,
  type PlanOverview,
  type WeekRow,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cacheGet, cacheSet, cacheDelPrefix } from "@/lib/cache";
import {
  PlanView,
  QuestionView,
  SummaryView,
} from "@/components/curriculum";
import { ProgressStrip } from "@/components/progress";
import {
  LoadingBlock,
  MessageBox,
  ScreenContainer,
  Toolbar,
} from "@/components/ui";
import { colors } from "@/lib/theme";

import { curriculumScreenStyles as styles } from "./[id].styles";

// Cache key helpers — group everything under `curriculum:<id>:*` so
// cacheDelPrefix("curriculum:<id>") wipes them all at once.
const ck = (id: string) => ({
  detail:   `curriculum:${id}`,
  weeks:    `curriculum:${id}:weeks`,
  progress: `curriculum:${id}:progress`,
});

type CurriculumRow = {
  assessor_status?: string;
  planner_status?: string;
  plan_json?: PlanOverview | null;
  assessment_json?: {
    transcript?: Array<{ question: string; options: string[]; answer: string | null }>;
    summary?: AssessorSummary;
  };
};

export default function CurriculumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [next, setNext] = useState<AssessorQuestion | null>(null);
  const [summary, setSummary] = useState<AssessorSummary | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const [plan, setPlan] = useState<PlanOverview | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[] | null>(null);
  const [planning, setPlanning] = useState(false);

  const [progress, setProgress] = useState<CurriculumProgressDetail | null>(null);
  const [replanning, setReplanning] = useState(false);
  const [addingSessions, setAddingSessions] = useState(false);
  const [makingHarder, setMakingHarder] = useState(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // ── Apply a fetched curriculum row to local state ──────────────────────
  const applyRow = useCallback((row: CurriculumRow) => {
    const transcript = row.assessment_json?.transcript ?? [];
    setQuestionCount(transcript.length);

    if (row.planner_status === "complete" && row.plan_json) {
      setPlan(row.plan_json);
      setSummary(row.assessment_json?.summary ?? null);
    } else if (row.assessor_status === "complete" && row.assessment_json?.summary) {
      setSummary(row.assessment_json.summary);
      setNext(null);
    } else {
      const last = transcript[transcript.length - 1];
      if (last && last.answer === null) {
        setNext({ question: last.question, options: last.options });
      } else {
        setNext(null);
      }
    }
  }, []);

  // ── Core loader — used on mount and pull-to-refresh ───────────────────
  const load = useCallback(
    async (token: string, bust = false) => {
      if (!id) return;
      const keys = ck(id);
      setError(null);

      try {
        // 1. Curriculum row
        const cachedRow = bust ? null : await cacheGet<CurriculumRow>(keys.detail);
        if (cachedRow) {
          applyRow(cachedRow);
          setLoading(false);
        }

        if (!cachedRow || bust) {
          const row = await api.getCurriculum(token, id) as CurriculumRow;
          applyRow(row);
          await cacheSet(keys.detail, row);
          setLoading(false);

          // 2. Weeks — only needed once plan is ready
          if (row.planner_status === "complete") {
            const cachedWeeks = bust ? null : await cacheGet<WeekRow[]>(keys.weeks);
            if (cachedWeeks) {
              setWeeks(cachedWeeks);
            } else {
              const w = await api.getWeeks(token, id);
              setWeeks(w.weeks);
              await cacheSet(keys.weeks, w.weeks);
            }
          }
        } else if (plan) {
          // Row came from cache + plan is already rendered: refresh weeks + progress
          const cachedWeeks = bust ? null : await cacheGet<WeekRow[]>(keys.weeks);
          if (cachedWeeks) {
            setWeeks(cachedWeeks);
          } else {
            const w = await api.getWeeks(token, id).catch(() => null);
            if (w) {
              setWeeks(w.weeks);
              await cacheSet(keys.weeks, w.weeks);
            }
          }
        }

        // 3. Progress — only when plan is ready
        const cachedProgress = bust
          ? null
          : await cacheGet<CurriculumProgressDetail>(keys.progress);
        if (cachedProgress) {
          setProgress(cachedProgress);
        } else {
          const p = await api.getCurriculumProgress(token, id).catch(() => null);
          if (p) {
            setProgress(p);
            await cacheSet(keys.progress, p);
          }
        }
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, applyRow],
  );

  // ── Mount ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !session?.access_token) return;
    load(session.access_token, false);
  }, [id, session?.access_token, load]);

  // ── Pull-to-refresh ────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    if (!session?.access_token) return;
    setRefreshing(true);
    await load(session.access_token, true);
    setRefreshing(false);
  }, [session?.access_token, load]);

  // ── Assessor ───────────────────────────────────────────────────────────
  const applyStep = (res: AssessorStepResponse) => {
    if (res.complete) {
      setSummary(res.complete);
      setNext(null);
    } else if (res.next) {
      setNext(res.next);
      setSummary(null);
      setQuestionCount((c) => c + 1);
    }
  };

  const answer = async (choice: string) => {
    if (!id || !session?.access_token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.submitAssessorAnswer(session.access_token, id, choice);
      applyStep(res);
      // Bust the detail cache so cold-opens reflect the new answer.
      if (id) await cacheDelPrefix(`curriculum:${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const replan = async () => {
    if (!id || !session?.access_token) return;
    setReplanning(true);
    setError(null);
    try {
      const token = session.access_token;
      await api.replan(token, id);
      await cacheDelPrefix(`curriculum:${id}`);
      const w = await api.getWeeks(token, id).catch(() => null);
      if (w) { setWeeks(w.weeks); await cacheSet(ck(id).weeks, w.weeks); }
      const p = await api.getCurriculumProgress(token, id).catch(() => null);
      if (p) { setProgress(p); await cacheSet(ck(id).progress, p); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReplanning(false);
    }
  };

  const addMoreSessions = async () => {
    if (!id || !session?.access_token) return;
    setAddingSessions(true);
    setError(null);
    setActionBanner(null);
    try {
      const token = session.access_token;
      // Generate 5 bonus exercises targeting weak areas. No new weeks needed.
      await api.addMoreSessions(token, id);
      await cacheDelPrefix(`curriculum:${id}`);
      const p = await api.getCurriculumProgress(token, id).catch(() => null);
      if (p) { setProgress(p); await cacheSet(ck(id).progress, p); }
      setActionBanner("Bonus exercises added! Open any week to practise them.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddingSessions(false);
    }
  };

  const makeHarder = async () => {
    if (!id || !session?.access_token) return;
    setMakingHarder(true);
    setError(null);
    setActionBanner(null);
    try {
      const token = session.access_token;
      await api.makeHarder(token, id);
      await cacheDelPrefix(`curriculum:${id}`);
      // Reload weeks + progress so the updated plan is visible immediately.
      const w = await api.getWeeks(token, id).catch(() => null);
      if (w) { setWeeks(w.weeks); await cacheSet(ck(id).weeks, w.weeks); }
      const p = await api.getCurriculumProgress(token, id).catch(() => null);
      if (p) { setProgress(p); await cacheSet(ck(id).progress, p); }
      setActionBanner("Plan updated — upcoming weeks are now more challenging.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMakingHarder(false);
    }
  };

  const generatePlan = async () => {
    if (!id || !session?.access_token) return;
    setPlanning(true);
    setError(null);
    try {
      const token = session.access_token;
      const res = await api.generatePlan(token, id);
      setPlan(res.plan);
      await cacheDelPrefix(`curriculum:${id}`);
      try {
        const w = await api.getWeeks(token, id);
        setWeeks(w.weeks);
        await cacheSet(ck(id).weeks, w.weeks);
      } catch {
        setWeeks(
          res.weeks.map((pw) => ({
            id: "",
            week_number: pw.week_number,
            plan_json: pw,
            status: "pending",
          })),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlanning(false);
    }
  };

  // Header gradient changes by phase.
  const headerColors = plan
    ? { from: colors.brand, via: colors.brandDeep, to: "#3a1f9e" }
    : summary
      ? { from: colors.success, via: colors.brand, to: colors.brandDeep }
      : { from: colors.brand, via: colors.accent, to: "#ff9966" };

  const goHome = () => router.replace("/");
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  return (
    <ScreenContainer
      gradient={{
        from: headerColors.from,
        via: headerColors.via,
        to: headerColors.to,
        angle: 150,
        height: 320,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Toolbar
        title={plan ? "Your plan" : summary ? "Almost there" : "Assessment"}
        onBack={goBack}
        onHome={goHome}
        disabled={submitting || planning}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
      >
        {loading ? (
          <LoadingBlock label="Loading…" />
        ) : plan ? (
          <>
            {progress ? (
              <ProgressStrip
                detail={progress}
                replanning={replanning}
                onReplan={replan}
                onOpenDashboard={() => router.push("/progress")}
              />
            ) : null}

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={[
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  addingSessions && styles.actionBtnDisabled,
                ]}
                onPress={addMoreSessions}
                disabled={addingSessions || makingHarder}
              >
                {addingSessions ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>＋ Add more sessions</Text>
                )}
              </Pressable>

              <Pressable
                style={[
                  styles.actionBtn,
                  styles.actionBtnSecondary,
                  makingHarder && styles.actionBtnDisabled,
                ]}
                onPress={makeHarder}
                disabled={addingSessions || makingHarder}
              >
                {makingHarder ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>🔥 Make it harder</Text>
                )}
              </Pressable>
            </View>

            {actionBanner ? (
              <View style={styles.actionBanner}>
                <Text style={styles.actionBannerText}>{actionBanner}</Text>
              </View>
            ) : null}

            <PlanView
              plan={plan}
              weeks={weeks ?? []}
              onStartSession={(weekId) =>
                router.push({
                  pathname: "/curriculum/session",
                  params: { curriculumId: id, weekId },
                })
              }
            />
          </>
        ) : summary ? (
          <SummaryView
            summary={summary}
            planning={planning}
            onGenerate={generatePlan}
          />
        ) : next ? (
          <QuestionView
            question={next}
            number={questionCount}
            submitting={submitting}
            onPick={answer}
          />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending question.</Text>
          </View>
        )}

        {error ? (
          <MessageBox
            variant="error"
            title="Something went wrong"
            message={error}
          />
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
