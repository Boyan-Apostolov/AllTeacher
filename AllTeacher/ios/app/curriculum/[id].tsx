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
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Curriculum detail + Assessor quiz loop.
 *
 * On mount:
 *   - GET /curriculum/:id, pull the transcript out of assessment_json.
 *   - If last entry has no answer, show that question.
 *   - If the row's assessor_status is "complete", show the summary.
 *
 * On answer:
 *   - POST /curriculum/:id/assessor { answer } — backend appends + asks the
 *     Assessor for the next step, returning either the next question or the
 *     final summary.
 */
export default function CurriculumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<AssessorQuestion | null>(null);
  const [summary, setSummary] = useState<AssessorSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);

  useEffect(() => {
    if (!id || !session?.access_token) return;
    let cancelled = false;

    (async () => {
      try {
        const row = (await api.getCurriculum(session.access_token, id)) as {
          assessor_status?: string;
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

        if (row.assessor_status === "complete" && row.assessment_json?.summary) {
          setSummary(row.assessment_json.summary);
          setNext(null);
        } else {
          const last = transcript[transcript.length - 1];
          if (last && last.answer === null) {
            setNext({ question: last.question, options: last.options });
          } else {
            // No pending question on the server — shouldn't normally happen
            // right after create, but tolerate it.
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

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: summary ? "Assessment" : "Assessment" }} />
      <View style={styles.toolbar}>
        <Pressable
          style={styles.toolbarBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          disabled={submitting}
        >
          <Text style={styles.toolbarBtnText}>← Back</Text>
        </Pressable>
        <Pressable
          style={styles.toolbarBtn}
          onPress={() => router.replace("/")}
          disabled={submitting}
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
        ) : summary ? (
          <SummaryView summary={summary} onDone={() => router.replace("/")} />
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
  onDone,
}: {
  summary: AssessorSummary;
  onDone: () => void;
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

      <Pressable style={styles.primary} onPress={onDone}>
        <Text style={styles.primaryText}>Done</Text>
      </Pressable>
      <Text style={styles.hint}>
        Curriculum planning (week-by-week) is the next step in the pipeline.
      </Text>
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
  title: { fontSize: 26, fontWeight: "700" },
  subtitle: { fontSize: 15, color: "#555" },
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
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
