/**
 * Curriculum detail screen — pure orchestration. Drives three sequential
 * states for one row:
 *   1. Assessor MCQ loop  (assessor_status != 'complete')
 *   2. Assessment summary + "Generate plan" CTA
 *   3. Plan view: title, summary, phases, week cards
 *
 * Rendering for each state lives in `components/curriculum/`.
 */
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  api,
  type AssessorQuestion,
  type AssessorStepResponse,
  type AssessorSummary,
  type PlanOverview,
  type WeekRow,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  PlanView,
  QuestionView,
  SummaryView,
} from "@/components/curriculum";
import {
  LoadingBlock,
  MessageBox,
  ScreenContainer,
  Toolbar,
} from "@/components/ui";
import { colors } from "@/lib/theme";

import { curriculumScreenStyles as styles } from "./[id].styles";

export default function CurriculumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [next, setNext] = useState<AssessorQuestion | null>(null);
  const [summary, setSummary] = useState<AssessorSummary | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const [plan, setPlan] = useState<PlanOverview | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[] | null>(null);
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    if (!id || !session?.access_token) return;
    let cancelled = false;
    const token = session.access_token;

    (async () => {
      try {
        const row = (await api.getCurriculum(token, id)) as {
          assessor_status?: string;
          planner_status?: string;
          plan_json?: PlanOverview | null;
          assessment_json?: {
            transcript?: Array<{
              question: string;
              options: string[];
              answer: string | null;
            }>;
            summary?: AssessorSummary;
          };
        };
        if (cancelled) return;

        const transcript = row.assessment_json?.transcript ?? [];
        setQuestionCount(transcript.length);

        if (row.planner_status === "complete" && row.plan_json) {
          setPlan(row.plan_json);
          setSummary(row.assessment_json?.summary ?? null);
          try {
            const w = await api.getWeeks(token, id);
            if (!cancelled) setWeeks(w.weeks);
          } catch {}
        } else if (
          row.assessor_status === "complete" &&
          row.assessment_json?.summary
        ) {
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
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, session?.access_token]);

  // Refresh weeks when the screen regains focus, so completed sessions
  // show their new status without forcing the user to leave and re-enter.
  useFocusEffect(
    useCallback(() => {
      if (!id || !session?.access_token || !plan) return;
      let cancelled = false;
      api
        .getWeeks(session.access_token, id)
        .then((w) => {
          if (!cancelled) setWeeks(w.weeks);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [id, session?.access_token, plan]),
  );

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
      const res = await api.submitAssessorAnswer(
        session.access_token,
        id,
        choice,
      );
      applyStep(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const generatePlan = async () => {
    if (!id || !session?.access_token) return;
    setPlanning(true);
    setError(null);
    try {
      const res = await api.generatePlan(session.access_token, id);
      setPlan(res.plan);
      try {
        const w = await api.getWeeks(session.access_token, id);
        setWeeks(w.weeks);
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
      >
        {loading ? (
          <LoadingBlock label="Loading…" />
        ) : plan ? (
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
