/**
 * Session screen — phase machine:
 *   lesson → exercises → next concept's lesson → ... → finished
 *                                                      ↘ (avg < 60% & user opts in)
 *                                                        bonus → finished
 *
 * Each planner module (concept) is taught with an Explainer-generated
 * lesson, then drilled with a small batch of exercises scoped to that
 * same module_index. The user moves through the week one concept at a
 * time. UI state lives here; rendering does not.
 *
 * The "bonus" phase runs after the normal session completes if the
 * average score was poor — it generates one extra batch focused on the
 * weak-area tags the Evaluator surfaced, with `module_index=null` on
 * the backend. Bonus rows are tracked in the `bonusIds` Set so the
 * wrap-up chart can mark them visually and so the bonus CTA only
 * appears once per session.
 *
 * Backwards-compatible with weeks whose `plan_json.modules` we can't
 * read (very old curricula): falls back to a single combined batch.
 */
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import {
  api,
  type ExerciseFeedback,
  type ExerciseRow,
  type ExerciseSubmission,
  type LessonRow,
  type PlanModule,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ExerciseView,
  FinishedView,
  LessonView,
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

type Phase = "lesson" | "exercises" | "bonus" | "finished";

const EXERCISES_PER_MODULE = 3;
const BONUS_DRILL_COUNT = 3;

export default function SessionScreen() {
  const { curriculumId, weekId } = useLocalSearchParams<{
    curriculumId: string;
    weekId: string;
  }>();
  const router = useRouter();
  const { session } = useAuth();

  // Bootstrap state.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<PlanModule[]>([]);

  // Phase machine state.
  const [phase, setPhase] = useState<Phase>("lesson");
  const [moduleIndex, setModuleIndex] = useState(0);
  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  // Bonus drill: tracked separately from per-module exercises because the
  // bonus rows have module_index=null and are run AFTER the wrap-up
  // (FinishedView) when the user opts in. We track which IDs are part of
  // the bonus run so FinishedView can highlight them in the chart and so
  // the bonus CTA hides itself once the drill has been started.
  const [bonusIds, setBonusIds] = useState<Set<string>>(new Set());
  const [bonusStarted, setBonusStarted] = useState(false);
  // Live SSE Evaluator output for the currently-submitting exercise.
  // Keyed by exercise id so we don't clobber state if the user retries
  // before the previous stream closes. Cleared once the stream emits its
  // final 'done' frame and the row flips to 'evaluated'.
  const [streamingFeedback, setStreamingFeedback] = useState<
    Record<string, { feedback?: string; gap?: string }>
  >({});

  // Per-phase loading flags so transitions feel instant when there's
  // nothing to fetch but show a spinner when we're hitting the LLM.
  const [phaseLoading, setPhaseLoading] = useState(false);
  const generationStarted = useRef<Set<string>>(new Set());
  // Mirror of moduleIndex so async fetches can check "is the user still
  // on the module we requested?" at apply-time. We deliberately do NOT
  // gate state writes on a per-effect `cancelled` flag because React 18
  // StrictMode (and any remount) cancels the in-flight effect while the
  // `generationStarted` dedup prevents the next mount from re-fetching —
  // that combination would discard the response and leave the screen
  // stuck on the spinner forever.
  const currentModuleRef = useRef(0);
  useEffect(() => {
    currentModuleRef.current = moduleIndex;
  }, [moduleIndex]);

  const totalModules = modules.length;

  // 1. Bootstrap: load the week's plan, existing lessons + exercises,
  //    decide where to drop the user in.
  useEffect(() => {
    if (!curriculumId || !weekId || !session?.access_token) return;
    let cancelled = false;
    const token = session.access_token;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [weeksRes, lessonsRes, exRes] = await Promise.all([
          api.getWeeks(token, curriculumId),
          api.listLessons(token, curriculumId, weekId),
          api.listExercises(token, curriculumId, weekId),
        ]);
        if (cancelled) return;

        const wk = (weeksRes.weeks ?? []).find((w) => w.id === weekId);
        const mods = (wk?.plan_json?.modules ?? []) as PlanModule[];
        const fallbackTotal = Math.max(1, mods.length);
        const have = exRes.exercises ?? [];
        const lessons = lessonsRes.lessons ?? [];

        setModules(mods);

        // Pick the starting module: lowest index whose lesson isn't seen
        // OR whose exercises aren't all evaluated yet. If everything in
        // the week is done, jump to finished.
        const seenLessonIdx = new Set(
          lessons.filter((l) => l.status === "seen").map((l) => l.module_index),
        );
        let startIdx = 0;
        let allDone = true;
        for (let i = 0; i < fallbackTotal; i++) {
          const here = have.filter((e) => (e.module_index ?? -1) === i);
          const lessonSeen = seenLessonIdx.has(i);
          const exercisesDone =
            here.length > 0 &&
            here.every((e) => e.status === "evaluated" || e.status === "skipped");
          if (!(lessonSeen && exercisesDone)) {
            startIdx = i;
            allDone = false;
            break;
          }
        }
        if (allDone) {
          // Whole week is finished — hop straight to the wrap-up using
          // every exercise we have so FinishedView can summarise.
          setExercises(have);
          setActiveIndex(have.length);
          setModuleIndex(Math.max(0, fallbackTotal - 1));
          setPhase("finished");
          setLoading(false);
          return;
        }

        setModuleIndex(startIdx);

        // Match this module's existing rows so we don't re-call the
        // backend if the user reopens mid-session.
        const startLesson =
          lessons.find((l) => l.module_index === startIdx) ?? null;
        const startExercises = have.filter(
          (e) => (e.module_index ?? -1) === startIdx,
        );

        if (startLesson && startLesson.status !== "seen") {
          setLesson(startLesson);
          setExercises(startExercises);
          setPhase("lesson");
        } else if (startLesson && startExercises.length > 0) {
          // Lesson already seen, exercises in flight — resume drilling.
          setLesson(startLesson);
          setExercises(startExercises);
          const firstUnfinished = startExercises.findIndex(
            (e) => e.status !== "evaluated" && e.status !== "skipped",
          );
          setActiveIndex(firstUnfinished >= 0 ? firstUnfinished : 0);
          setPhase("exercises");
        } else {
          // Need to generate the lesson.
          setLesson(null);
          setExercises(startExercises);
          setPhase("lesson");
        }
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [curriculumId, weekId, session?.access_token]);

  // 2. When the lesson screen needs content and we don't have it yet,
  //    fetch (or generate via the Explainer) for the active module.
  //
  // We don't use a per-effect `cancelled` flag here: in dev StrictMode
  // the effect mounts → unmounts → remounts, and the dedup ref in
  // `generationStarted` blocks the second mount from re-issuing the
  // request. If we let the cleanup ignore the response, the spinner
  // would hang until the next time the screen is opened. Instead, we
  // apply the response whenever the user is still viewing the module
  // it was generated for (compared via `currentModuleRef`).
  useEffect(() => {
    if (loading) return;
    if (phase !== "lesson") return;
    if (!curriculumId || !weekId || !session?.access_token) return;
    if (lesson && lesson.module_index === moduleIndex) return;

    const token = session.access_token;
    const key = `lesson:${weekId}:${moduleIndex}`;
    if (generationStarted.current.has(key)) return;
    generationStarted.current.add(key);

    const requestedModule = moduleIndex;
    setPhaseLoading(true);
    (async () => {
      try {
        const row = await api.generateLesson(token, curriculumId, {
          week_id: weekId,
          module_index: requestedModule,
        });
        // Only apply if the user hasn't moved on to a different module.
        if (currentModuleRef.current !== requestedModule) return;
        setLesson(row);
      } catch (e) {
        // Free the dedup slot so a retry can happen on next render.
        generationStarted.current.delete(key);
        if (currentModuleRef.current === requestedModule) {
          setError((e as Error).message);
        }
      } finally {
        if (currentModuleRef.current === requestedModule) {
          setPhaseLoading(false);
        }
      }
    })();
  }, [phase, moduleIndex, lesson, curriculumId, weekId, session?.access_token, loading]);

  // 3a. Bonus drill: when the user enters the bonus phase from
  //     FinishedView, generate one batch of weak-area-focused exercises.
  //     These have module_index=null on the backend; we track their ids
  //     in `bonusIds` so the rest of the screen can distinguish them
  //     from the regular module batches.
  useEffect(() => {
    if (loading) return;
    if (phase !== "bonus") return;
    if (!curriculumId || !weekId || !session?.access_token) return;
    if (bonusIds.size > 0) return;

    const token = session.access_token;
    const key = `bonus:${weekId}`;
    if (generationStarted.current.has(key)) return;
    generationStarted.current.add(key);

    setPhaseLoading(true);
    (async () => {
      try {
        const gen = await api.generateExercises(token, curriculumId, {
          week_id: weekId,
          count: BONUS_DRILL_COUNT,
          focus_weak_areas: true,
        });
        const fresh = gen.exercises ?? [];
        setExercises((cur) => {
          const seen = new Set(cur.map((e) => e.id));
          const adds = fresh.filter((e) => !seen.has(e.id));
          return adds.length === 0 ? cur : [...cur, ...adds];
        });
        setBonusIds(new Set(fresh.map((e) => e.id)));
        setActiveIndex(0);
      } catch (e) {
        generationStarted.current.delete(key);
        setError((e as Error).message);
      } finally {
        setPhaseLoading(false);
      }
    })();
  }, [phase, bonusIds, curriculumId, weekId, session?.access_token, loading]);

  // 3. When exercise phase starts and we don't yet have a batch for the
  //    active module, generate one filtered to module_index.
  //
  // Same StrictMode-safe pattern as the lesson effect — apply by module
  // identity, not by an effect-scoped cancellation flag.
  useEffect(() => {
    if (loading) return;
    if (phase !== "exercises") return;
    if (!curriculumId || !weekId || !session?.access_token) return;
    const here = exercises.filter(
      (e) => (e.module_index ?? -1) === moduleIndex,
    );
    if (here.length > 0) return;

    const token = session.access_token;
    const key = `ex:${weekId}:${moduleIndex}`;
    if (generationStarted.current.has(key)) return;
    generationStarted.current.add(key);

    const requestedModule = moduleIndex;
    setPhaseLoading(true);
    (async () => {
      try {
        const gen = await api.generateExercises(token, curriculumId, {
          week_id: weekId,
          count: EXERCISES_PER_MODULE,
          module_index: requestedModule,
        });
        // Stitch in regardless of mount churn — the rows are tagged with
        // module_index so the filtered render will pick the right ones.
        const fresh = gen.exercises ?? [];
        setExercises((cur) => {
          const seenIds = new Set(cur.map((e) => e.id));
          const additions = fresh.filter((e) => !seenIds.has(e.id));
          return additions.length === 0 ? cur : [...cur, ...additions];
        });
        if (currentModuleRef.current === requestedModule) {
          setActiveIndex(0);
        }
      } catch (e) {
        generationStarted.current.delete(key);
        if (currentModuleRef.current === requestedModule) {
          setError((e as Error).message);
        }
      } finally {
        if (currentModuleRef.current === requestedModule) {
          setPhaseLoading(false);
        }
      }
    })();
  }, [phase, moduleIndex, exercises, curriculumId, weekId, session?.access_token, loading]);

  // ----- transitions -----

  const startExercises = async () => {
    if (!lesson || !session?.access_token) return;
    setError(null);
    // Fire-and-forget: marking seen shouldn't block the UI.
    api
      .markLessonSeen(session.access_token, lesson.id)
      .catch(() => {
        /* fail-soft — the next bootstrap will retry */
      });
    setLesson({ ...lesson, status: "seen" });
    // Reset activeIndex so the next module starts at 0 (the previous
    // module's exercises are kept in `exercises` for the wrap-up).
    setActiveIndex(0);
    setPhase("exercises");
  };

  const advanceModule = () => {
    if (moduleIndex + 1 >= Math.max(1, totalModules)) {
      setPhase("finished");
      return;
    }
    const nextIdx = moduleIndex + 1;
    setModuleIndex(nextIdx);
    setLesson(null);
    setActiveIndex(0);
    setPhase("lesson");
  };

  // Active exercise resolution. The "bonus" phase has its own batch
  // (rows whose ids live in `bonusIds`); regular phases see only rows
  // tagged with the current module_index.
  const moduleExercises =
    phase === "bonus"
      ? exercises.filter((e) => bonusIds.has(e.id))
      : exercises.filter((e) => (e.module_index ?? -1) === moduleIndex);
  const active = moduleExercises[activeIndex] ?? null;

  const submit = async (submission: ExerciseSubmission) => {
    if (!active || !session?.access_token) return;
    setError(null);
    const id = active.id;
    const exType = active.content_json.type;
    setExercises((cur) =>
      cur.map((e) =>
        e.id === id
          ? { ...e, status: "submitted", submission_json: submission }
          : e,
      ),
    );

    // Apply the final Evaluator result to the exercise row + clear any
    // streaming partial. Pulled out so the streaming and non-streaming
    // paths land in exactly the same shape.
    const applyFinal = (res: {
      score: number;
      verdict: ExerciseFeedback["verdict"];
      feedback: string;
      gap?: string;
      weak_areas: string[];
      strengths?: string[];
      next_focus: string;
    }) => {
      const feedback: ExerciseFeedback = {
        score: res.score,
        verdict: res.verdict,
        feedback: res.feedback,
        // `gap` and `strengths` were added when we replaced the static
        // Exercise Writer `explanation` with a per-answer "where it fell
        // short" line — pass them through so FeedbackCard can render
        // them and FinishedView can aggregate strengths.
        gap: res.gap,
        weak_areas: res.weak_areas,
        strengths: res.strengths,
        next_focus: res.next_focus,
      };
      setExercises((cur) =>
        cur.map((e) =>
          e.id === id
            ? {
                ...e,
                status: "evaluated",
                score: res.score,
                feedback_json: feedback,
              }
            : e,
        ),
      );
      setStreamingFeedback((cur) => {
        if (!(id in cur)) return cur;
        const { [id]: _drop, ...rest } = cur;
        return rest;
      });
    };

    const onError = (msg: string) => {
      setError(msg);
      setExercises((cur) =>
        cur.map((ex) =>
          ex.id === id ? { ...ex, status: "pending" } : ex,
        ),
      );
      setStreamingFeedback((cur) => {
        if (!(id in cur)) return cur;
        const { [id]: _drop, ...rest } = cur;
        return rest;
      });
    };

    // Streaming path — only worthwhile for `short_answer` (legacy
    // `essay_prompt` rows still in the DB share the same long-form
    // feedback shape so we stream those too). Multiple-choice and
    // flashcards score in <1s; the SSE round-trip overhead would just
    // slow them down. Any failure mid-stream falls through to the
    // non-streaming path so the user still gets feedback.
    const shouldStream = exType === "short_answer" || exType === "essay_prompt";

    if (shouldStream) {
      // Initialise an empty streaming entry so ExerciseView can swap
      // the spinner for the streaming card immediately on submit.
      setStreamingFeedback((cur) => ({ ...cur, [id]: { feedback: "", gap: "" } }));
      try {
        let gotDone = false;
        for await (const frame of api.submitExerciseStream(
          session.access_token,
          id,
          submission,
        )) {
          if (frame.kind === "delta") {
            const snap = frame.snapshot;
            setStreamingFeedback((cur) => ({
              ...cur,
              [id]: {
                feedback:
                  typeof snap.feedback === "string"
                    ? snap.feedback
                    : cur[id]?.feedback,
                gap:
                  typeof snap.gap === "string"
                    ? snap.gap
                    : cur[id]?.gap,
              },
            }));
          } else if (frame.kind === "done") {
            gotDone = true;
            applyFinal(frame.payload);
            break;
          } else if (frame.kind === "error") {
            // Fall back to the non-streaming submit so the user still
            // gets feedback. We don't surface the SSE error to the user
            // unless the fallback also fails — streaming is an
            // optimisation, not a contract.
            // eslint-disable-next-line no-console
            console.warn("submit stream error, falling back:", frame);
            break;
          }
        }
        if (gotDone) return;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("submit stream threw, falling back:", e);
      }
      // Streaming path didn't yield a final result — fall through to
      // the regular POST below. Drop the streaming placeholder so the
      // spinner shows during the fallback.
      setStreamingFeedback((cur) => {
        if (!(id in cur)) return cur;
        const { [id]: _drop, ...rest } = cur;
        return rest;
      });
    }

    try {
      const res = await api.submitExercise(
        session.access_token,
        id,
        submission,
      );
      applyFinal(res);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const next = () => {
    const moduleCount = moduleExercises.length;
    if (phase === "bonus") {
      // Bonus drill is a single batch — when it's done, return to the
      // wrap-up screen so the user sees the updated chart with their
      // bonus bars rolled in.
      if (activeIndex + 1 >= moduleCount) {
        setPhase("finished");
        setActiveIndex(0);
      } else {
        setActiveIndex((i) => i + 1);
      }
      return;
    }
    if (activeIndex + 1 >= moduleCount) {
      // Last exercise of this module — bridge to the next concept.
      advanceModule();
    } else {
      setActiveIndex((i) => i + 1);
    }
  };

  const startBonus = () => {
    setError(null);
    setBonusStarted(true);
    setActiveIndex(0);
    setPhase("bonus");
  };

  // ----- progress accounting -----

  // Progress accounting only counts non-bonus rows so the bar reflects
  // the planned curriculum, not the optional bonus drill bolted on at
  // the end. Bonus and finished phases pin the bar at 100%.
  const evaluatedCount = exercises.filter(
    (e) => e.status === "evaluated" && !bonusIds.has(e.id),
  ).length;
  const expectedTotal =
    Math.max(1, totalModules) * EXERCISES_PER_MODULE;
  const liveProgress =
    Math.min(evaluatedCount / Math.max(1, expectedTotal), 1);
  const moduleProgress =
    moduleIndex / Math.max(1, totalModules);
  const shownProgress =
    phase === "finished" || phase === "bonus"
      ? 1
      : Math.max(moduleProgress, liveProgress);

  const accent = active
    ? typeAccent[active.content_json.type as keyof typeof typeAccent] ??
      typeAccent.multiple_choice
    : typeAccent.multiple_choice;

  const goHome = () => router.replace("/");
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  // ----- render -----

  const renderBody = () => {
    if (loading) return <LoadingBlock label="Loading your session…" />;
    if (error) {
      return (
        <MessageBox
          variant="error"
          title="Something went wrong"
          message={error}
        />
      );
    }
    if (phase === "finished") {
      return (
        <FinishedView
          exercises={exercises}
          bonusIds={bonusIds}
          // Eligible to OFFER the bonus drill iff it hasn't been started
          // for this session yet. The threshold check (avg < 60%) lives
          // inside FinishedView so the visual stays consistent.
          bonusEligible={!bonusStarted}
          onHome={goHome}
          onStartBonus={startBonus}
        />
      );
    }
    if (phase === "lesson") {
      if (phaseLoading || !lesson) {
        return <LoadingBlock label="Preparing your lesson…" />;
      }
      return (
        <LessonView
          lesson={lesson}
          moduleIndex={moduleIndex}
          totalModules={Math.max(1, totalModules)}
          onStartExercises={startExercises}
        />
      );
    }
    // phase === 'exercises' or 'bonus' — both use the same exercise UI.
    if (phaseLoading && moduleExercises.length === 0) {
      return (
        <LoadingBlock
          label={
            phase === "bonus"
              ? "Building your bonus drill…"
              : "Building your exercises…"
          }
        />
      );
    }
    if (active) {
      const moduleCount = moduleExercises.length;
      const isLastInBatch = activeIndex >= moduleCount - 1;
      const isLastModule = moduleIndex + 1 >= Math.max(1, totalModules);
      const isLast =
        phase === "bonus"
          ? isLastInBatch
          : isLastInBatch && isLastModule;
      return (
        <ExerciseView
          exercise={active}
          total={moduleCount}
          index={activeIndex}
          onSubmit={submit}
          onNext={next}
          isLast={isLast}
          streamingFeedback={streamingFeedback[active.id]}
        />
      );
    }
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>No exercises yet.</Text>
      </View>
    );
  };

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
        {renderBody()}
      </ScrollView>
    </ScreenContainer>
  );
}
