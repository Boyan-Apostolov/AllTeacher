import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  type PlanWeek,
  type WeekRow,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Gradient } from "@/components/Gradient";
import { colors, radii, shadow, spacing } from "@/lib/theme";

/**
 * Curriculum detail screen — drives three sequential states for one row:
 *   1. Assessor MCQ loop  (assessor_status != 'complete')
 *   2. Assessment summary + "Generate plan" CTA
 *   3. Plan view: title, summary, phases, week cards
 */
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

  // When the screen regains focus (e.g. coming back from a finished
  // session), refresh the weeks so completed sessions show their new
  // status without forcing the user to leave and re-enter the course.
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

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <Gradient
        from={headerColors.from}
        via={headerColors.via}
        to={headerColors.to}
        angle={150}
        style={styles.bgGradient}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
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
          <Text style={styles.toolbarTitle}>
            {plan ? "Your plan" : summary ? "Almost there" : "Assessment"}
          </Text>
          <Pressable
            style={styles.toolbarBtn}
            onPress={() => router.replace("/")}
            disabled={submitting || planning}
          >
            <Text style={styles.toolbarBtnText}>Home</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.textOnDark} />
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
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
            <View style={styles.card}>
              <Text style={styles.value}>No pending question.</Text>
            </View>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
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
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xs }}>
        <View style={styles.progressRow}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < Math.min(number, 6) && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        <Text style={styles.heroEyebrow}>Question {number}</Text>
        <Text style={styles.heroTitle}>{question.question}</Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {question.options.map((opt, idx) => (
          <Pressable
            key={`${idx}-${opt}`}
            style={({ pressed }) => [
              styles.option,
              submitting && styles.optionDisabled,
              pressed && !submitting && styles.optionPressed,
            ]}
            onPress={() => onPick(opt)}
            disabled={submitting}
          >
            <View style={styles.optionDot}>
              <Text style={styles.optionDotText}>
                {String.fromCharCode(65 + idx)}
              </Text>
            </View>
            <Text style={styles.optionText}>{opt}</Text>
          </Pressable>
        ))}
      </View>

      {submitting ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textOnDark} />
          <Text style={styles.loadingText}>Thinking…</Text>
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
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xs }}>
        <Text style={styles.heroEyebrow}>Step 2 of 2</Text>
        <Text style={styles.heroTitle}>Assessment{"\n"}complete ✅</Text>
        <Text style={styles.heroSub}>
          Here's what we picked up from your answers.
        </Text>
      </View>

      <View style={styles.card}>
        <SummaryRow icon="🎓" label="Domain" value={summary.domain} />
        <SummaryRow icon="📊" label="Level" value={summary.level} />
        <SummaryRow
          icon="💡"
          label="Learning style"
          value={summary.learning_style}
        />
        <SummaryRow
          icon="⏱️"
          label="Time / day"
          value={`${summary.time_budget_mins_per_day} min`}
        />
        {summary.target_language ? (
          <SummaryRow
            icon="🌍"
            label="Target language"
            value={summary.target_language}
          />
        ) : null}
        {summary.notes ? (
          <SummaryRow icon="📝" label="Notes" value={summary.notes} />
        ) : null}
      </View>

      <Pressable
        disabled={planning}
        onPress={onGenerate}
        style={({ pressed }) => [
          styles.cta,
          planning && styles.ctaDisabled,
          pressed && !planning && styles.ctaPressed,
        ]}
      >
        <Gradient
          from={colors.brand}
          to={colors.brandDeep}
          angle={135}
          style={styles.ctaGradient}
        >
          {planning ? (
            <ActivityIndicator color={colors.textOnDark} />
          ) : (
            <Text style={styles.ctaText}>✨ Generate my plan</Text>
          )}
        </Gradient>
      </Pressable>
      <Text style={styles.heroHint}>
        {planning
          ? "Drafting your week-by-week plan… 10–30 seconds."
          : "We'll build a personal week-by-week curriculum from this."}
      </Text>
    </View>
  );
}

function PlanView({
  plan,
  weeks,
  onStartSession,
}: {
  plan: PlanOverview;
  weeks: WeekRow[];
  onStartSession: (weekId: string) => void;
}) {
  const sortedWeeks = weeks
    .slice()
    .sort((a, b) => a.week_number - b.week_number);
  const upcoming =
    sortedWeeks.find((w) => w.status !== "complete") ?? null;
  const completedCount = sortedWeeks.filter(
    (w) => w.status === "complete",
  ).length;
  const totalCount = sortedWeeks.length;
  const allDone = totalCount > 0 && completedCount >= totalCount;
  const pct = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xs }}>
        <Text style={styles.heroEyebrow}>{plan.total_weeks}-week plan</Text>
        <Text style={styles.heroTitle}>{plan.title}</Text>
        <Text style={styles.heroSub}>{plan.summary_for_user}</Text>
      </View>

      {/* Course-level progress + "Up next" hero — pinned to the top so the
          user can always see how far they are and jump straight into the
          next session. */}
      {totalCount > 0 ? (
        <View style={styles.upNextCard}>
          <View style={styles.upNextHeaderRow}>
            <Text style={styles.upNextEyebrow}>
              {allDone ? "Course complete" : "Up next"}
            </Text>
            <Text style={styles.upNextProgress}>
              {completedCount}/{totalCount} sessions
            </Text>
          </View>
          <View style={styles.upNextBarTrack}>
            <View
              style={[
                styles.upNextBarFill,
                {
                  width: `${Math.round(pct * 100)}%`,
                  backgroundColor: allDone ? colors.success : colors.brand,
                },
              ]}
            />
          </View>
          {upcoming ? (
            <>
              <Text style={styles.upNextWeekLabel}>
                Week {upcoming.plan_json.week_number}
                {upcoming.status === "in_progress" ? " · in progress" : ""}
              </Text>
              <Text style={styles.upNextTitle}>
                {upcoming.plan_json.title}
              </Text>
              {upcoming.plan_json.objective ? (
                <Text style={styles.upNextObjective}>
                  {upcoming.plan_json.objective}
                </Text>
              ) : null}
              {upcoming.id ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.cta,
                    pressed && styles.ctaPressed,
                    { marginTop: spacing.sm },
                  ]}
                  onPress={() => onStartSession(upcoming.id)}
                >
                  <Gradient
                    from={colors.brand}
                    to={colors.brandDeep}
                    angle={135}
                    style={styles.ctaGradient}
                  >
                    <Text style={styles.ctaText}>
                      {upcoming.status === "in_progress"
                        ? "Continue session →"
                        : "Start session →"}
                    </Text>
                  </Gradient>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={styles.upNextObjective}>
              Every session is done. Great work 🎉
            </Text>
          )}
        </View>
      ) : null}

      {plan.phases.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionHeader}>Phases</Text>
          {plan.phases.map((p, i) => (
            <View key={`${i}-${p.name}`} style={styles.phaseCard}>
              <View style={styles.phaseStripe} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.phaseName}>{p.name}</Text>
                <Text style={styles.phaseWeeks}>
                  Weeks {p.week_numbers.join(", ")}
                </Text>
                <Text style={styles.value}>{p.description}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionHeader}>All sessions</Text>
        {sortedWeeks.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.hint}>No week details loaded.</Text>
          </View>
        ) : (
          sortedWeeks.map((row, idx) => (
            <WeekCard
              key={row.id || row.week_number}
              row={row}
              index={idx}
              isUpcoming={!!upcoming && row.id === upcoming.id}
              onStartSession={
                row.id ? () => onStartSession(row.id) : undefined
              }
            />
          ))
        )}
      </View>
    </View>
  );
}

const WEEK_GRADIENTS: Array<{ from: string; to: string }> = [
  { from: "#a78bfa", to: "#7c5cff" },
  { from: "#67e8f9", to: "#0ea5e9" },
  { from: "#86efac", to: "#16a34a" },
  { from: "#fbbf24", to: "#d97706" },
  { from: "#fb7185", to: "#e11d48" },
  { from: "#f472b6", to: "#db2777" },
];

function WeekCard({
  row,
  index,
  isUpcoming,
  onStartSession,
}: {
  row: WeekRow;
  index: number;
  isUpcoming?: boolean;
  onStartSession?: () => void;
}) {
  const week: PlanWeek = row.plan_json;
  const grad = WEEK_GRADIENTS[index % WEEK_GRADIENTS.length];
  const isComplete = row.status === "complete";
  const isInProgress = row.status === "in_progress";
  return (
    <View
      style={[
        styles.weekCard,
        isComplete && styles.weekCardComplete,
        !isComplete && isUpcoming && styles.weekCardUpcoming,
      ]}
    >
      <View style={styles.weekHeader}>
        <Gradient
          from={grad.from}
          to={grad.to}
          angle={135}
          style={styles.weekBadge}
        >
          <Text style={styles.weekBadgeText}>
            {isComplete ? "✓" : `W${week.week_number}`}
          </Text>
        </Gradient>
        <View style={{ flex: 1 }}>
          <View style={styles.weekTitleRow}>
            <Text style={styles.weekTitle}>{week.title}</Text>
            {isComplete ? (
              <View style={styles.weekStatusPillDone}>
                <Text style={styles.weekStatusPillDoneText}>Completed</Text>
              </View>
            ) : isInProgress ? (
              <View style={styles.weekStatusPillProgress}>
                <Text style={styles.weekStatusPillProgressText}>
                  In progress
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.weekObjective}>{week.objective}</Text>
        </View>
      </View>

      <View style={styles.divider} />
      <Text style={styles.fieldLabel}>Modules</Text>
      <View style={{ gap: spacing.sm }}>
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
      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>🎯 {week.milestone}</Text>
        </View>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>⏱️ {week.daily_minutes} min/day</Text>
        </View>
      </View>
      {week.exercise_focus.length > 0 ? (
        <Text style={styles.focusText}>
          Focus: {week.exercise_focus.join(" · ")}
        </Text>
      ) : null}

      {onStartSession ? (
        <Pressable
          style={({ pressed }) => [
            styles.weekCta,
            pressed && styles.ctaPressed,
          ]}
          onPress={onStartSession}
        >
          <Gradient
            from={isComplete ? colors.success : grad.from}
            to={isComplete ? colors.success : grad.to}
            angle={135}
            style={styles.weekCtaGradient}
          >
            <Text style={styles.weekCtaText}>
              {isComplete
                ? "Review session ✓"
                : isInProgress
                  ? "Continue session →"
                  : "Start session →"}
            </Text>
          </Gradient>
        </Pressable>
      ) : null}
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgGradient: { ...StyleSheet.absoluteFillObject, height: 320 },
  safe: { flex: 1 },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toolbarBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  toolbarBtnText: {
    fontSize: 14,
    color: colors.textOnDark,
    fontWeight: "700",
  },
  toolbarTitle: {
    color: colors.textOnDark,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  center: { alignItems: "center", gap: 8, paddingVertical: spacing.xxl },
  loadingText: { fontSize: 13, color: colors.textOnDark, fontWeight: "600" },

  heroEyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: spacing.sm,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.4,
    lineHeight: 36,
  },
  heroSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 22,
  },
  heroHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },

  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.xs,
  },
  progressDot: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  progressDotActive: {
    backgroundColor: colors.textOnDark,
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadow.card,
  },
  optionDisabled: { opacity: 0.5 },
  optionPressed: { transform: [{ scale: 0.99 }], backgroundColor: colors.brandSoft },
  optionDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  optionDotText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brandDeep,
  },
  optionText: { flex: 1, fontSize: 16, color: colors.text, lineHeight: 22 },

  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
    ...shadow.card,
  },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  summaryIcon: { fontSize: 20 },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: { fontSize: 15, color: colors.text, marginTop: 2 },

  errorBox: {
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    gap: 4,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.danger,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "600" },

  cta: {
    borderRadius: radii.pill,
    overflow: "hidden",
    ...shadow.raised,
  },
  ctaGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: { transform: [{ scale: 0.98 }] },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.textOnDark, fontSize: 17, fontWeight: "800" },

  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textOnDark,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: spacing.xs,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  hint: { fontSize: 13, color: colors.textMuted },
  value: { fontSize: 14, color: colors.text, lineHeight: 20 },

  phaseCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  phaseStripe: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  phaseName: { fontSize: 17, fontWeight: "800", color: colors.text },
  phaseWeeks: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  weekCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
    ...shadow.card,
  },
  weekCardComplete: {
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  weekCardUpcoming: {
    borderWidth: 2,
    borderColor: colors.brand,
  },

  // "Up next" hero pinned to the top of the course view
  upNextCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.brand,
    ...shadow.raised,
  },
  upNextHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  upNextEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  upNextProgress: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  upNextBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
    marginVertical: spacing.xs,
  },
  upNextBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  upNextWeekLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  upNextTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  upNextObjective: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  weekHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  weekBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  weekBadgeText: {
    color: colors.textOnDark,
    fontSize: 14,
    fontWeight: "800",
  },
  weekTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  weekStatusPillDone: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
  },
  weekStatusPillDoneText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textOnDark,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  weekStatusPillProgress: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.warningSoft,
  },
  weekStatusPillProgressText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.warning,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  weekTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  weekObjective: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: 2,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  moduleRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  kindPill: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  kindPillText: {
    fontSize: 11,
    color: colors.brandDeep,
    fontWeight: "800",
    textTransform: "lowercase",
  },
  moduleTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  moduleDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
  },
  metaPillText: { fontSize: 12, color: colors.text, fontWeight: "600" },
  focusText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: "italic",
  },

  weekCta: {
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  weekCtaGradient: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  weekCtaText: { color: colors.textOnDark, fontSize: 15, fontWeight: "800" },
});
