import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import {
  api,
  type ExerciseContent,
  type ExerciseFeedback,
  type ExerciseRow,
  type ExerciseSubmission,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Gradient } from "@/components/Gradient";
import { colors, radii, shadow, spacing, typeAccent } from "@/lib/theme";

/**
 * Exercise session screen.
 *
 * Loads (or generates) exercises for one curriculum_weeks row, then walks
 * the user through them one at a time. UI uses per-type accent gradients.
 */
export default function SessionScreen() {
  const { curriculumId, weekId } = useLocalSearchParams<{
    curriculumId: string;
    weekId: string;
  }>();
  const router = useRouter();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const generationStarted = useRef(false);

  useEffect(() => {
    if (!curriculumId || !weekId || !session?.access_token) return;
    let cancelled = false;
    const token = session.access_token;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const list = await api.listExercises(token, curriculumId, weekId);
        if (cancelled) return;
        const have = list.exercises ?? [];
        const firstUnfinished = have.findIndex(
          (e) => e.status !== "evaluated" && e.status !== "skipped",
        );

        if (have.length > 0) {
          setExercises(have);
          setActiveIndex(firstUnfinished >= 0 ? firstUnfinished : 0);
          setLoading(false);
          return;
        }

        if (generationStarted.current) return;
        generationStarted.current = true;
        const gen = await api.generateExercises(token, curriculumId, {
          week_id: weekId,
          count: 5,
        });
        if (cancelled) return;
        setExercises(gen.exercises ?? []);
        setActiveIndex(0);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [curriculumId, weekId, session?.access_token]);

  const active = exercises[activeIndex] ?? null;

  const submit = async (submission: ExerciseSubmission) => {
    if (!active || !session?.access_token) return;
    setError(null);
    const idx = activeIndex;
    setExercises((cur) =>
      cur.map((e, i) =>
        i === idx
          ? { ...e, status: "submitted", submission_json: submission }
          : e,
      ),
    );
    try {
      const res = await api.submitExercise(
        session.access_token,
        active.id,
        submission,
      );
      const feedback: ExerciseFeedback = {
        score: res.score,
        verdict: res.verdict,
        feedback: res.feedback,
        weak_areas: res.weak_areas,
        next_focus: res.next_focus,
      };
      setExercises((cur) =>
        cur.map((e, i) =>
          i === idx
            ? {
                ...e,
                status: "evaluated",
                score: res.score,
                feedback_json: feedback,
              }
            : e,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
      setExercises((cur) =>
        cur.map((e, i) =>
          i === idx ? { ...e, status: "pending" } : e,
        ),
      );
    }
  };

  const next = () => {
    setActiveIndex((i) => Math.min(i + 1, exercises.length));
  };

  const total = exercises.length;
  const finished = total > 0 && activeIndex >= total;
  const progress = total > 0 ? Math.min(activeIndex / total, 1) : 0;
  const evaluatedCount = exercises.filter(
    (e) => e.status === "evaluated",
  ).length;
  const liveProgress =
    total > 0 ? Math.min(evaluatedCount / total, 1) : 0;
  const shownProgress = finished ? 1 : Math.max(progress, liveProgress);

  const accent = active
    ? typeAccent[active.content_json.type as keyof typeof typeAccent] ??
      typeAccent.multiple_choice
    : typeAccent.multiple_choice;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <Gradient
        from={accent.gradientFrom}
        to={accent.gradientTo}
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
          >
            <Text style={styles.toolbarBtnText}>← Back</Text>
          </Pressable>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(shownProgress * 100)}%` },
              ]}
            />
          </View>
          <Pressable
            style={styles.toolbarBtn}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.toolbarBtnText}>Home</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.textOnDark} />
              <Text style={styles.loadingText}>Loading your session…</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : finished ? (
            <FinishedView
              exercises={exercises}
              onHome={() => router.replace("/")}
            />
          ) : active ? (
            <ExerciseView
              exercise={active}
              total={total}
              index={activeIndex}
              onSubmit={submit}
              onNext={next}
              isLast={activeIndex >= total - 1}
            />
          ) : (
            <View style={styles.card}>
              <Text style={styles.value}>No exercises yet.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ----- per-type rendering -----

function ExerciseView({
  exercise,
  total,
  index,
  onSubmit,
  onNext,
  isLast,
}: {
  exercise: ExerciseRow;
  total: number;
  index: number;
  onSubmit: (s: ExerciseSubmission) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const c = exercise.content_json;
  const evaluated = exercise.status === "evaluated";
  const submitting = exercise.status === "submitted" && !evaluated;
  const feedback = exercise.feedback_json;
  const accent =
    typeAccent[c.type as keyof typeof typeAccent] ?? typeAccent.multiple_choice;

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xs }}>
        <View style={styles.kindRow}>
          <View style={styles.kindPill}>
            <Text style={styles.kindEmoji}>{accent.emoji}</Text>
            <Text style={styles.kindText}>{accent.label}</Text>
          </View>
          <Text style={styles.kindCount}>
            {Math.min(index + 1, total)} of {total}
          </Text>
        </View>
        <Text style={styles.exerciseTitle}>{c.title}</Text>
      </View>

      {c.type === "multiple_choice" ? (
        <MultipleChoice
          content={c}
          submission={exercise.submission_json}
          disabled={submitting || evaluated}
          onPick={(idx) => onSubmit({ choice_index: idx })}
        />
      ) : c.type === "flashcard" ? (
        <Flashcard
          // Re-mount per exercise so the flip state resets cleanly.
          key={exercise.id}
          content={c}
          submission={exercise.submission_json}
          disabled={submitting || evaluated}
          onRate={(rating) => onSubmit({ self_rating: rating })}
        />
      ) : c.type === "short_answer" ? (
        <ShortAnswer
          key={exercise.id}
          content={c}
          submission={exercise.submission_json}
          disabled={submitting || evaluated}
          onSubmit={(text) => onSubmit({ text })}
        />
      ) : c.type === "essay_prompt" ? (
        <EssayPrompt
          key={exercise.id}
          content={c}
          submission={exercise.submission_json}
          disabled={submitting || evaluated}
          onSubmit={(text) => onSubmit({ text })}
        />
      ) : (
        <View style={styles.card}>
          <Text style={styles.value}>Unknown exercise type.</Text>
        </View>
      )}

      {submitting ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textOnDark} />
          <Text style={styles.loadingText}>Scoring…</Text>
        </View>
      ) : null}

      {evaluated && feedback ? (
        <FeedbackCard feedback={feedback} content={c} />
      ) : null}

      {evaluated ? (
        <Pressable
          onPress={onNext}
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaPressed,
          ]}
        >
          <Gradient
            from={accent.gradientFrom}
            to={accent.gradientTo}
            angle={135}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>
              {isLast ? "Finish session 🎉" : "Next exercise →"}
            </Text>
          </Gradient>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------- Multiple choice ----------

function MultipleChoice({
  content,
  submission,
  disabled,
  onPick,
}: {
  content: ExerciseContent;
  submission: ExerciseRow["submission_json"];
  disabled: boolean;
  onPick: (idx: number) => void;
}) {
  const chosen =
    submission && "choice_index" in submission
      ? submission.choice_index
      : null;
  const correct = content.correct_index;

  return (
    <View style={{ gap: spacing.sm }}>
      {content.prompt ? (
        <Text style={styles.prompt}>{content.prompt}</Text>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        {(content.options ?? []).map((opt, idx) => {
          const isChosen = chosen === idx;
          const showCorrect = disabled && correct === idx;
          const showWrong = disabled && isChosen && correct !== idx;
          return (
            <Pressable
              key={`${idx}-${opt}`}
              style={({ pressed }) => [
                styles.option,
                isChosen && styles.optionChosen,
                showCorrect && styles.optionCorrect,
                showWrong && styles.optionWrong,
                disabled && !isChosen && !showCorrect && styles.optionFaded,
                pressed && !disabled && styles.optionPressed,
              ]}
              onPress={() => onPick(idx)}
              disabled={disabled}
            >
              <View
                style={[
                  styles.optionDot,
                  showCorrect && styles.optionDotCorrect,
                  showWrong && styles.optionDotWrong,
                ]}
              >
                <Text
                  style={[
                    styles.optionDotText,
                    (showCorrect || showWrong) && styles.optionDotTextOnAccent,
                  ]}
                >
                  {showCorrect ? "✓" : showWrong ? "✕" : String.fromCharCode(65 + idx)}
                </Text>
              </View>
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------- Flashcard ----------

function Flashcard({
  content,
  submission,
  disabled,
  onRate,
}: {
  content: ExerciseContent;
  submission: ExerciseRow["submission_json"];
  disabled: boolean;
  onRate: (rating: "easy" | "medium" | "hard") => void;
}) {
  const initial = Boolean(submission && "self_rating" in submission);
  const [revealed, setRevealed] = useState(initial);
  const flip = useRef(new Animated.Value(initial ? 1 : 0)).current;
  const accent = typeAccent.flashcard;

  const chosenRating =
    submission && "self_rating" in submission ? submission.self_rating : null;

  const animateFlip = (toRevealed: boolean) => {
    Animated.timing(flip, {
      toValue: toRevealed ? 1 : 0,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const toggle = () => {
    if (disabled) return;
    const r = !revealed;
    setRevealed(r);
    animateFlip(r);
  };

  // Front face: 0deg → 180deg
  const frontStyle = {
    transform: [
      {
        rotateY: flip.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "180deg"],
        }),
      },
    ],
    opacity: flip.interpolate({
      inputRange: [0, 0.5, 0.5001, 1],
      outputRange: [1, 1, 0, 0],
    }),
  };
  // Back face: 180deg → 360deg
  const backStyle = {
    transform: [
      {
        rotateY: flip.interpolate({
          inputRange: [0, 1],
          outputRange: ["180deg", "360deg"],
        }),
      },
    ],
    opacity: flip.interpolate({
      inputRange: [0, 0.4999, 0.5, 1],
      outputRange: [0, 0, 1, 1],
    }),
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Pressable
        onPress={toggle}
        disabled={disabled}
        style={styles.flashcardWrap}
        accessibilityRole="button"
        accessibilityLabel={revealed ? "Show front" : "Reveal answer"}
      >
        <Animated.View style={[styles.flashcardFace, frontStyle]}>
          <Gradient
            from={accent.gradientFrom}
            to={accent.gradientTo}
            angle={140}
            style={styles.flashcardGradient}
          >
            <View style={styles.flashcardCorner}>
              <Text style={styles.flashcardCornerText}>FRONT</Text>
            </View>
            <Text style={styles.flashcardEmoji}>🃏</Text>
            <Text style={styles.flashcardText}>{content.front}</Text>
            <View style={styles.flashcardHintRow}>
              <Text style={styles.flashcardHint}>Tap to reveal →</Text>
            </View>
          </Gradient>
        </Animated.View>

        <Animated.View
          style={[styles.flashcardFace, styles.flashcardFaceAbs, backStyle]}
          pointerEvents={revealed ? "auto" : "none"}
        >
          <Gradient
            from="#ffffff"
            to="#f4eefe"
            angle={150}
            style={[styles.flashcardGradient, styles.flashcardBack]}
          >
            <View style={[styles.flashcardCorner, styles.flashcardCornerLight]}>
              <Text
                style={[
                  styles.flashcardCornerText,
                  styles.flashcardCornerTextLight,
                ]}
              >
                BACK
              </Text>
            </View>
            <Text style={styles.flashcardEmojiLight}>💡</Text>
            <Text style={styles.flashcardTextDark}>{content.back}</Text>
            <View style={styles.flashcardHintRow}>
              <Text style={styles.flashcardHintDark}>Tap to flip back</Text>
            </View>
          </Gradient>
        </Animated.View>
      </Pressable>

      {revealed ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.ratingPrompt}>How well did you know this?</Text>
          <View style={styles.ratingRow}>
            {(
              [
                { r: "hard", label: "Hard", emoji: "😅", from: "#fb7185", to: "#e11d48" },
                { r: "medium", label: "Medium", emoji: "🤔", from: "#fbbf24", to: "#d97706" },
                { r: "easy", label: "Easy", emoji: "😎", from: "#86efac", to: "#16a34a" },
              ] as const
            ).map((b) => {
              const active = chosenRating === b.r;
              return (
                <Pressable
                  key={b.r}
                  onPress={() => onRate(b.r)}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.ratingBtn,
                    disabled && !active && styles.ratingBtnFaded,
                    pressed && !disabled && styles.optionPressed,
                  ]}
                >
                  {active ? (
                    <Gradient
                      from={b.from}
                      to={b.to}
                      angle={135}
                      style={styles.ratingBtnGradient}
                    >
                      <Text style={styles.ratingEmoji}>{b.emoji}</Text>
                      <Text style={styles.ratingTextActive}>{b.label}</Text>
                    </Gradient>
                  ) : (
                    <View style={styles.ratingBtnInner}>
                      <Text style={styles.ratingEmoji}>{b.emoji}</Text>
                      <Text style={styles.ratingText}>{b.label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------- Short answer ----------

function ShortAnswer({
  content,
  submission,
  disabled,
  onSubmit,
}: {
  content: ExerciseContent;
  submission: ExerciseRow["submission_json"];
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const initial =
    submission && "text" in submission ? submission.text : "";
  const [text, setText] = useState(initial);
  const [focused, setFocused] = useState(false);
  const accent = typeAccent.short_answer;

  return (
    <View style={{ gap: spacing.md }}>
      {content.prompt ? (
        <Text style={styles.prompt}>{content.prompt}</Text>
      ) : null}
      <TextInput
        style={[
          styles.textInput,
          focused && styles.textInputFocused,
          disabled && styles.textInputDisabled,
        ]}
        value={text}
        onChangeText={setText}
        placeholder="Type your answer…"
        placeholderTextColor={colors.textFaint}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        autoCapitalize="none"
        multiline
      />
      <Pressable
        disabled={disabled || text.trim().length === 0}
        onPress={() => onSubmit(text.trim())}
        style={({ pressed }) => [
          styles.cta,
          (disabled || text.trim().length === 0) && styles.ctaDisabled,
          pressed && !disabled && styles.ctaPressed,
        ]}
      >
        <Gradient
          from={accent.gradientFrom}
          to={accent.gradientTo}
          angle={135}
          style={styles.ctaGradient}
        >
          <Text style={styles.ctaText}>Submit answer →</Text>
        </Gradient>
      </Pressable>
    </View>
  );
}

// ---------- Essay prompt ----------

function EssayPrompt({
  content,
  submission,
  disabled,
  onSubmit,
}: {
  content: ExerciseContent;
  submission: ExerciseRow["submission_json"];
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const initial =
    submission && "text" in submission ? submission.text : "";
  const [text, setText] = useState(initial);
  const [focused, setFocused] = useState(false);
  const accent = typeAccent.essay_prompt;

  return (
    <View style={{ gap: spacing.md }}>
      {content.prompt ? (
        <Text style={styles.prompt}>{content.prompt}</Text>
      ) : null}
      {content.expected_length ? (
        <Text style={styles.metaPill}>
          Suggested length: {content.expected_length}
        </Text>
      ) : null}
      {(content.rubric?.length ?? 0) > 0 ? (
        <View style={styles.rubricCard}>
          <Text style={styles.rubricTitle}>What we'll look for</Text>
          {content.rubric!.map((r, i) => (
            <View key={i} style={styles.rubricRow}>
              <Text style={styles.rubricBullet}>•</Text>
              <Text style={styles.rubricText}>{r}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        style={[
          styles.textInput,
          styles.textInputTall,
          focused && styles.textInputFocused,
          disabled && styles.textInputDisabled,
        ]}
        value={text}
        onChangeText={setText}
        placeholder="Write here…"
        placeholderTextColor={colors.textFaint}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline
      />
      <Pressable
        disabled={disabled || text.trim().length === 0}
        onPress={() => onSubmit(text.trim())}
        style={({ pressed }) => [
          styles.cta,
          (disabled || text.trim().length === 0) && styles.ctaDisabled,
          pressed && !disabled && styles.ctaPressed,
        ]}
      >
        <Gradient
          from={accent.gradientFrom}
          to={accent.gradientTo}
          angle={135}
          style={styles.ctaGradient}
        >
          <Text style={styles.ctaText}>Submit response →</Text>
        </Gradient>
      </Pressable>
    </View>
  );
}

// ---------- Feedback ----------

function FeedbackCard({
  feedback,
  content,
}: {
  feedback: ExerciseFeedback;
  content: ExerciseContent;
}) {
  const tone =
    feedback.verdict === "correct"
      ? {
          icon: "🎉",
          label: "Correct!",
          bg: colors.successSoft,
          fg: colors.success,
        }
      : feedback.verdict === "incorrect"
        ? {
            icon: "💪",
            label: "Not quite",
            bg: colors.dangerSoft,
            fg: colors.danger,
          }
        : feedback.verdict === "reviewed"
          ? {
              icon: "🔁",
              label: "Reviewed",
              bg: colors.infoSoft,
              fg: colors.info,
            }
          : {
              icon: "📝",
              label: "Partial",
              bg: colors.warningSoft,
              fg: colors.warning,
            };

  return (
    <View style={[styles.feedbackCard, { backgroundColor: tone.bg }]}>
      <View style={styles.feedbackHeader}>
        <View style={styles.feedbackVerdictRow}>
          <Text style={styles.feedbackIcon}>{tone.icon}</Text>
          <Text style={[styles.feedbackVerdict, { color: tone.fg }]}>
            {tone.label}
          </Text>
        </View>
        <Text style={[styles.feedbackScore, { color: tone.fg }]}>
          {Math.round((feedback.score ?? 0) * 100)}%
        </Text>
      </View>
      <Text style={styles.feedbackBody}>{feedback.feedback}</Text>
      {content.explanation ? (
        <View style={styles.feedbackBlock}>
          <Text style={styles.feedbackLabel}>Explanation</Text>
          <Text style={styles.feedbackBody}>{content.explanation}</Text>
        </View>
      ) : null}
      {feedback.weak_areas.length > 0 ? (
        <View style={styles.feedbackBlock}>
          <Text style={styles.feedbackLabel}>To revisit</Text>
          {feedback.weak_areas.map((w, i) => (
            <Text key={i} style={styles.feedbackBody}>
              • {w}
            </Text>
          ))}
        </View>
      ) : null}
      {feedback.next_focus ? (
        <View style={styles.feedbackBlock}>
          <Text style={styles.feedbackLabel}>Next focus</Text>
          <Text style={styles.feedbackBody}>{feedback.next_focus}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------- Finished ----------

function FinishedView({
  exercises,
  onHome,
}: {
  exercises: ExerciseRow[];
  onHome: () => void;
}) {
  const evaluated = exercises.filter((e) => e.status === "evaluated");
  const avg = useMemo(
    () =>
      evaluated.length > 0
        ? evaluated.reduce((acc, e) => acc + (e.score ?? 0), 0) /
          evaluated.length
        : 0,
    [evaluated],
  );
  const pct = Math.round(avg * 100);
  const cheer =
    pct >= 90
      ? "Outstanding! 🌟"
      : pct >= 75
        ? "Strong work! 🎉"
        : pct >= 50
          ? "Solid progress 💪"
          : "Every rep counts 🌱";

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xs }}>
        <Text style={styles.heroEyebrow}>Session complete</Text>
        <Text style={styles.heroTitle}>{cheer}</Text>
        <Text style={styles.heroSub}>
          You finished {evaluated.length} of {exercises.length} exercises.
        </Text>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreNumber}>{pct}%</Text>
        <Text style={styles.scoreLabel}>average score</Text>
      </View>

      <Pressable
        onPress={onHome}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Gradient
          from={colors.brand}
          to={colors.brandDeep}
          angle={135}
          style={styles.ctaGradient}
        >
          <Text style={styles.ctaText}>Back to home →</Text>
        </Gradient>
      </Pressable>
    </View>
  );
}

// ---------- styles ----------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgGradient: { ...StyleSheet.absoluteFillObject, height: 280 },
  safe: { flex: 1 },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.32)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.textOnDark,
    borderRadius: 3,
  },

  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  center: { alignItems: "center", gap: 8, paddingVertical: spacing.xxl },
  loadingText: { fontSize: 13, color: colors.textOnDark, fontWeight: "600" },

  // Header
  kindRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kindPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  kindEmoji: { fontSize: 14 },
  kindText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brandDeep,
    letterSpacing: 0.4,
  },
  kindCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  exerciseTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.3,
    lineHeight: 30,
  },

  // Generic prompts / cards
  prompt: {
    fontSize: 17,
    color: colors.text,
    lineHeight: 24,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    ...shadow.card,
  },
  value: { fontSize: 15, color: colors.text, lineHeight: 22 },

  // MCQ
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 2,
    borderColor: "transparent",
    ...shadow.card,
  },
  optionPressed: { transform: [{ scale: 0.99 }] },
  optionChosen: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  optionFaded: { opacity: 0.55 },
  optionDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  optionDotCorrect: { backgroundColor: colors.success },
  optionDotWrong: { backgroundColor: colors.danger },
  optionDotText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brandDeep,
  },
  optionDotTextOnAccent: { color: colors.textOnDark },
  optionText: { flex: 1, fontSize: 16, color: colors.text, lineHeight: 22 },

  // Flashcard
  flashcardWrap: {
    height: 320,
    borderRadius: radii.xl,
  },
  flashcardFace: {
    flex: 1,
    borderRadius: radii.xl,
    overflow: "hidden",
    backfaceVisibility: "hidden",
    ...shadow.raised,
  },
  flashcardFaceAbs: {
    ...StyleSheet.absoluteFillObject,
  },
  flashcardGradient: {
    flex: 1,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  flashcardBack: {
    backgroundColor: colors.surface,
  },
  flashcardCorner: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  flashcardCornerLight: {
    backgroundColor: colors.brandSoft,
  },
  flashcardCornerText: {
    color: colors.textOnDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  flashcardCornerTextLight: { color: colors.brandDeep },
  flashcardEmoji: { fontSize: 36 },
  flashcardEmojiLight: { fontSize: 36 },
  flashcardText: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textOnDark,
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  flashcardTextDark: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    lineHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  flashcardHintRow: {
    position: "absolute",
    bottom: spacing.lg,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  flashcardHint: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  flashcardHintDark: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // Rating
  ratingPrompt: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textOnDark,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  ratingRow: { flexDirection: "row", gap: spacing.sm },
  ratingBtn: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  ratingBtnInner: {
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  ratingBtnGradient: {
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  ratingBtnFaded: { opacity: 0.5 },
  ratingEmoji: { fontSize: 22 },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  ratingTextActive: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textOnDark,
  },

  // Text inputs
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 80,
    color: colors.text,
    ...shadow.card,
  },
  textInputTall: { minHeight: 200, textAlignVertical: "top" },
  textInputFocused: { borderColor: colors.brand },
  textInputDisabled: { opacity: 0.7 },

  // Rubric
  metaPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
    overflow: "hidden",
  },
  rubricCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  rubricTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  rubricRow: { flexDirection: "row", gap: 8 },
  rubricBullet: { color: colors.brand, fontSize: 16, fontWeight: "800" },
  rubricText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },

  // CTAs
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
  ctaText: { color: colors.textOnDark, fontSize: 16, fontWeight: "800" },

  // Feedback
  feedbackCard: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
    ...shadow.card,
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feedbackVerdictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  feedbackIcon: { fontSize: 22 },
  feedbackVerdict: {
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  feedbackScore: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  feedbackBody: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  feedbackBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    gap: 4,
  },
  feedbackLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // Errors
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

  // Finished
  heroEyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.4,
    lineHeight: 38,
  },
  heroSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 22,
  },
  scoreCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radii.xl,
    alignItems: "center",
    gap: spacing.xs,
    ...shadow.raised,
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: "900",
    color: colors.brandDeep,
    letterSpacing: -2,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
