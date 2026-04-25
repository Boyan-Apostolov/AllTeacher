import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  api,
  type AssessorQuestion,
  type AssessorStepResponse,
  type AssessorSummary,
  type PlanOverview,
  type PlanWeek,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Curriculum detail screen — drives three sequential states for one row:
 *
 *   1. Assessor MCQ loop  (assessor_status != 'complete')
 *   2. Assessment summary + "Generate plan" CTA
 *      (assessor_status == 'complete' && planner_status != 'complete')
 *   3. Plan view: title, summary, phases, week cards
 *      (planner_status == 'complete')
 *
 * State is loaded once on mount and refreshed after each transition.
 */
export default function CurriculumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Assessor state.
  const [next, setNext] = useState<AssessorQuestion | null>(null);
  const [summary, setSummary] = useState<AssessorSummary | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  // Planner state.
  const [plan, setPlan] = useState<PlanOverview | null>(null);
  const [weeks, setWeeks] = useState<PlanWeek[] | null>(null);
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

        // Plan already exists?
        if (row.planner_status === "complete" && row.plan_json) {
          setPlan(row.plan_json);
          setSummary(row.assessment_json?.summary ?? null);
          // Fetch weeks separately.
          try {
            const w = await api.getWeeks(token, id);
            if (!cancelled) setWeeks(w.weeks.map((r) => r.plan_json));
          } catch {
            /* non-fatal */
          }
        } else if (
          row.assessor_status === "complete" &&
          row.assessment_json?.summary
        ) {
          // Assessor done, plan not yet.
          setSummary(row.assessment_json.summary);
          setNext(null);
        } else {
          // Still in the assessor loop.
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
      setWeeks(res.weeks);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlanning(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Curriculum" }} />
      <View style={styles.toolbar}>
        <Pressable
          style={styles.toolbarBtn}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          disabled={submitting || planning}
        >
          <Text style={styles.toolbarBtnText}>← Back</Text>
        </Pressable>
        <Pressable
          style={styles.toolbarBtn}
          onPress={() => router.replace("/")}
          disabled={submitting || planning}
        >
          <Text style={styles.toolbarBtnText}>Home</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.hint}>Loading…</Text>
          </View>
        ) : plan ? (
          <PlanView plan={plan} weeks={weeks ?? []} />
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
          <View style={styles.card}>
            <Text style={styles.value}>No pending question.</Text>
          </View>
        )}

        {error ? (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.label}>Error</Text>
            <Text style={styles.value}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuestionView({
  question,
  number,
  submitting,
  onPick,
}: {
  question: AssessorQuestion;
  number: number;
  submitting: boolean;
  onPick: (choice: string) => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.step}>Question {number}</Text>
      <Text style={styles.question}>{question.question}</Text>

      <View style={{ gap: 10 }}>
        {question.options.map((opt, idx) => (
          <Pressable
            key={`${idx}-${opt}`}
            style={[styles.option, submitting && styles.optionDisabled]}
            onPress={() => onPick(opt)}
            disabled={submitting}
          >
            <Text style={styles.optionText}>{opt}</Text>
          </Pressable>
        ))}
      </View>

      {submitting ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.hint}>Thinking…</Text>
        </View>
      ) : null}
    </View>
  );
}

function SummaryView({
  summary,
  planning,
  onGenerate,
}: {
  summary: AssessorSummary;
  planning: boolean;
  onGenerate: () => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.title}>Assessment complete</Text>
      <Text style={styles.subtitle}>
        Here's what the Assessor picked up from your answers.
      </Text>

      <View style={[styles.card, styles.cardOk]}>
        <Row label="Domain" value={summary.domain} />
        <Row label="Level" value={summary.level} />
        <Row label="Learning style" value={summary.learning_style} />
        <Row
          label="Time / day"
          value={`${summary.time_budget_mins_per_day} min`}
        />
        {summary.target_language ? (
          <Row label="Target language" value={summary.target_language} />
        ) : null}
        {summary.notes ? <Row label="Notes" value={summary.notes} /> : null}
      </View>

      <Pressable
        style={[styles.primary, planning && styles.primaryDisabled]}
        onPress={onGenerate}
        disabled={planning}
      >
        {planning ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Generate my plan</Text>
        )}
      </Pressable>
      {planning ? (
        <Text style={styles.hint}>
          The Planner is drafting your week-by-week curriculum. This usually
          takes 10–30 seconds.
        </Text>
      ) : (
        <Text style={styles.hint}>
          The Planner will use this assessment to build your week-by-week
          curriculum.
        </Text>
      )}
    </View>
  );
}

function PlanView({
  plan,
  weeks,
}: {
  plan: PlanOverview;
  weeks: PlanWeek[];
}) {
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <Text style={styles.step}>{plan.total_weeks}-week plan</Text>
        <Text style={styles.title}>{plan.title}</Text>
        <Text style={styles.summaryText}>{plan.summary_for_user}</Text>
      </View>

      {plan.phases.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionHeader}>Phases</Text>
          {plan.phases.map((p, i) => (
            <View key={`${i}-${p.name}`} style={styles.card}>
              <Text style={styles.phaseName}>{p.name}</Text>
              <Text style={styles.phaseWeeks}>
                Weeks {p.week_numbers.join(", ")}
              </Text>
              <Text style={styles.value}>{p.description}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Text style={styles.sectionHeader}>Weeks</Text>
        {weeks.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.hint}>No week details loaded.</Text>
          </View>
        ) : (
          weeks
            .slice()
            .sort((a, b) => a.week_number - b.week_number)
            .map((w) => <WeekCard key={w.week_number} week={w} />)
        )}
      </View>
    </View>
  );
}

function WeekCard({ week }: { week: PlanWeek }) {
  return (
    <View style={styles.card}>
      <View style={styles.weekHeader}>
        <Text style={styles.weekNumber}>W{week.week_number}</Text>
        <Text style={styles.weekTitle}>{week.title}</Text>
      </View>
      <Text style={styles.weekObjective}>{week.objective}</Text>
      <View style={styles.divider} />
      <Text style={styles.label}>Modules</Text>
      <View style={{ gap: 8 }}>
        {week.modules.map((m, i) => (
          <View key={`${i}-${m.title}`} style={styles.moduleRow}>
            <View style={styles.kindPill}>
              <Text style={styles.kindPillText}>{m.kind}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.moduleTitle}>{m.title}</Text>
              <Text style={styles.moduleDesc}>{m.description}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.divider} />
      <Row label="Milestone" value={week.milestone} />
      <Row label="Per day" value={`${week.daily_minutes} min`} />
      {week.exercise_focus.length > 0 ? (
        <Row label="Focus" value={week.exercise_focus.join(", ")} />
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fafafa",
  },
  toolbarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toolbarBtnText: { fontSize: 15, color: "#0a84ff", fontWeight: "600" },
  content: { padding: 24, gap: 16 },
  center: { alignItems: "center", gap: 8, paddingVertical: 24 },
  title: { fontSize: 26, fontWeight: "700", lineHeight: 32 },
  subtitle: { fontSize: 15, color: "#555" },
  summaryText: { fontSize: 15, color: "#333", lineHeight: 22 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
  },
  step: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
  },
  question: { fontSize: 20, fontWeight: "600", lineHeight: 28 },
  option: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionDisabled: { opacity: 0.5 },
  optionText: { fontSize: 16, color: "#222" },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    gap: 10,
  },
  cardOk: { borderColor: "#b7eb8f", backgroundColor: "#f6ffed" },
  cardError: { borderColor: "#ffa39e", backgroundColor: "#fff1f0" },
  row: { gap: 2 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
  },
  value: { fontSize: 15, color: "#222" },
  hint: { fontSize: 12, color: "#888" },
  primary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  phaseName: { fontSize: 16, fontWeight: "700", color: "#111" },
  phaseWeeks: { fontSize: 12, color: "#888", textTransform: "uppercase" },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  weekNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: "#111",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  weekTitle: { fontSize: 17, fontWeight: "700", color: "#111", flex: 1 },
  weekObjective: { fontSize: 14, color: "#444", lineHeight: 20 },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 4 },
  moduleRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  kindPill: {
    backgroundColor: "#eef3ff",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  kindPillText: {
    fontSize: 11,
    color: "#0a84ff",
    fontWeight: "700",
    textTransform: "lowercase",
  },
  moduleTitle: { fontSize: 14, fontWeight: "600", color: "#222" },
  moduleDesc: { fontSize: 13, color: "#555", lineHeight: 18 },
});
