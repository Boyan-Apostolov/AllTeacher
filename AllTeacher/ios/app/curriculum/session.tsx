/**
 * Exercise session screen — pure orchestration.
 *
 * Loads (or generates) exercises for one curriculum_weeks row, walks the
 * user through them one at a time, and stitches together the components
 * in `components/session/`. UI state lives here; rendering does not.
 */
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import {
  api,
  type ExerciseFeedback,
  type ExerciseRow,
  type ExerciseSubmission,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ExerciseView,
  FinishedView,
} from "@/components/session";
import {
  LoadingBlock,
  MessageBox,
  ProgressBar,
  ScreenContainer,
  Toolbar,
} from "@/components/ui";
import { colors, typeAccent } from "@/lib/theme";

import { sessionScreenStyles as styles } from "./session.styles";

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

  const goHome = () => router.replace("/");
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  return (
    <ScreenContainer
      gradient={{
        from: accent.gradientFrom,
        to: accent.gradientTo,
        angle: 150,
        height: 280,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Toolbar
        onBack={goBack}
        onHome={goHome}
        middle={
          <ProgressBar
            pct={shownProgress}
            color={colors.textOnDark}
            trackColor="rgba(255,255,255,0.32)"
            height={6}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <LoadingBlock label="Loading your session…" />
        ) : error ? (
          <MessageBox
            variant="error"
            title="Something went wrong"
            message={error}
          />
        ) : finished ? (
          <FinishedView exercises={exercises} onHome={goHome} />
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No exercises yet.</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
