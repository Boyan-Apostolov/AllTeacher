/**
 * Thin wrapper around fetch() for hitting the Flask backend.
 *
 * Base URL comes from EXPO_PUBLIC_API_URL (see .env.example).
 * In dev on iOS simulator, that's http://localhost:8000.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export type HealthResponse = {
  status: string;
  service: string;
  env: string;
  configured: {
    supabase: boolean;
    openai: boolean;
    revenuecat: boolean;
  };
};

export type AssessorQuestion = {
  question: string;
  options: string[];
};

export type AssessorSummary = {
  domain: string;
  level: string;
  learning_style: string;
  time_budget_mins_per_day: number;
  target_language: string | null;
  notes?: string;
};

export type AssessorStepResponse = {
  id: string;
  next: AssessorQuestion | null;
  complete: AssessorSummary | null;
};

export type CurriculumListItem = {
  id: string;
  topic: string | null;
  goal: string | null;
  domain: string | null;
  status: string | null;
  assessor_status: string | null;
  planner_status: string | null;
  level: string | null;
  created_at: string;
  // Rolled-up progress stats from the backend so the home screen can render
  // a real progress bar without N round-trips. May be missing on older API
  // versions — treat all as optional.
  total_weeks?: number;
  exercises_total?: number;
  exercises_completed?: number;
  avg_score?: number | null;
  sessions_total?: number;
  sessions_completed?: number;
};

export type PlanPhase = {
  name: string;
  description: string;
  week_numbers: number[];
};

export type PlanModule = {
  title: string;
  kind: string;
  description: string;
};

export type PlanWeek = {
  week_number: number;
  title: string;
  objective: string;
  modules: PlanModule[];
  milestone: string;
  daily_minutes: number;
  exercise_focus: string[];
};

export type PlanOverview = {
  title: string;
  summary_for_user: string;
  total_weeks: number;
  phases: PlanPhase[];
};

export type PlanResponse = {
  id: string;
  plan: PlanOverview;
  weeks: PlanWeek[];
};

export type WeekRow = {
  id: string;
  week_number: number;
  plan_json: PlanWeek;
  status: string;
};

// --- Exercises (Exercise Writer + Evaluator) ---

// `essay_prompt` is a legacy type — new generations only emit the three
// types above. The iOS renderer still routes it to ShortAnswer so old
// rows in the DB keep rendering after the schema change.
export type ExerciseType =
  | "multiple_choice"
  | "flashcard"
  | "short_answer"
  | "essay_prompt"
  | "listen_choice"
  | "image_match";  // reserved — no Writer support yet, here so the
                    // discriminated union narrows cleanly when the
                    // next iteration ships it.

export type ExerciseContent = {
  type: ExerciseType;
  title: string;
  // multiple_choice
  prompt?: string;
  options?: string[];
  correct_index?: number;
  // flashcard
  front?: string;
  back?: string;
  // short_answer
  expected?: string;
  rubric?: string[];
  // legacy essay_prompt — kept for old rows
  expected_length?: string;
  // legacy — Exercise Writer no longer emits this; per-answer "why this
  // missed the goal" comes from ExerciseFeedback.gap instead
  explanation?: string;
  // listen_choice — audio comprehension. `audio_url` is the public
  // Supabase Storage URL the orchestrator generates post-Writer via
  // OpenAI TTS. `audio_text` is what's spoken (target_language);
  // `prompt_native` is the question above the play button
  // (native_language); `language` is BCP-47.
  audio_url?: string;
  audio_text?: string;
  language?: string;
  prompt_native?: string;
  // image_match (reserved) — URL of the image shown above the
  // multiple-choice options (which reuse `options` + `correct_index`).
  image_url?: string;
};

export type ExerciseSubmission =
  | { choice_index: number }
  | { self_rating: "easy" | "medium" | "hard"; note?: string }
  | { text: string };

export type ExerciseFeedback = {
  score: number;
  verdict: "correct" | "partial" | "incorrect" | "reviewed";
  feedback: string;
  // Per-answer explanation of *why* the user's submission missed the
  // goal. Empty for verdict='correct' / score≥0.9. Replaces the static
  // ExerciseContent.explanation that used to repeat the prompt.
  gap?: string;
  weak_areas: string[];
  strengths?: string[];
  next_focus: string;
};

export type ExerciseRow = {
  id: string;
  week_id: string | null;
  type: ExerciseType;
  content_json: ExerciseContent;
  submission_json: ExerciseSubmission | null;
  feedback_json: ExerciseFeedback | null;
  module_index: number | null;
  status: "pending" | "submitted" | "evaluated" | "skipped";
  score: number | null;
  seen: boolean;
  created_at: string;
  evaluated_at: string | null;
};

export type GenerateExercisesResponse = {
  curriculum_id: string;
  week_id: string;
  exercises: ExerciseRow[];
};

export type SubmitExerciseResponse = ExerciseFeedback & {
  id: string;
  status: "evaluated";
};

// --- streaming evaluator (SSE) ---
//
// `submitExerciseStream` calls POST /curriculum/exercises/<id>/submit/stream
// and yields the Evaluator's structured-output snapshots as they
// materialise. The iOS session screen renders `feedback` + `gap` text
// live token-by-token; everything else (verdict, score, weak_areas,
// strengths, next_focus) lands in the final 'done' frame.
//
// We model partial snapshots as Partial<ExerciseFeedback> because the
// evaluator's response schema matches ExerciseFeedback exactly — keys
// just trail in as the model produces them.
export type EvaluatorSnapshot = Partial<ExerciseFeedback>;

export type SubmitStreamFrame =
  | { kind: "delta"; snapshot: EvaluatorSnapshot }
  | { kind: "done"; payload: SubmitExerciseResponse }
  | { kind: "error"; error: string; detail?: string };

// --- Lessons (Explainer) — short adaptive intro before each module ---

export type LessonContent = {
  concept_title: string;
  intro: string;
  key_points: string[];
  example: string;
  pitfalls: string[];
  next_up: string;
  // Optional Mermaid source. Empty string = no diagram for this concept.
  // The Explainer is told to leave it empty for short text-only lessons
  // and to fill it for structural concepts (process flows, hierarchies,
  // sequences, comparisons). Rendered client-side via a WebView +
  // mermaid.min.js — see components/lesson/MermaidDiagram.tsx.
  diagram_mermaid?: string;
};

export type LessonRow = {
  id: string;
  curriculum_id: string;
  week_id: string;
  module_index: number;
  concept_title: string;
  content_json: LessonContent;
  status: "pending" | "ready" | "seen";
  seen_at: string | null;
  created_at: string | null;
};

// --- Tracker / Adapter (progress dashboard + re-plan) ---

export type StreakSummary = {
  current_days: number;
  best_days: number;
  last_active: string | null;
};

export type ActivityDay = {
  date: string;       // ISO yyyy-mm-dd
  active: boolean;
};

export type TagStat = {
  tag: string;
  count: number;
};

export type DashboardCurriculumRow = {
  id: string;
  topic: string | null;
  goal: string | null;
  domain: string | null;
  level: string | null;
  assessor_status: string | null;
  planner_status: string | null;
  sessions_total: number;
  sessions_completed: number;
  exercises_total: number;
  exercises_completed: number;
  avg_score: number | null;
  last_active_at: string | null;
  replan_count: number;
  current_week: number | null;
  next_milestone: string | null;
};

export type DashboardTotals = {
  curricula: number;
  sessions_total: number;
  sessions_completed: number;
  exercises_total: number;
  exercises_completed: number;
  avg_score: number | null;
};

export type DashboardSummary = {
  streak: StreakSummary;
  activity: ActivityDay[];
  totals: DashboardTotals;
  top_weak_areas: TagStat[];
  top_strengths: TagStat[];
  curricula: DashboardCurriculumRow[];
};

export type WeekProgress = {
  id: string;
  week_number: number | null;
  title: string | null;
  status: string | null;
  is_bonus: boolean;
  exercises_total: number;
  exercises_completed: number;
  avg_score: number | null;
};

export type CurriculumProgressDetail = {
  id: string;
  topic: string | null;
  goal: string | null;
  domain: string | null;
  level: string | null;
  replan_count: number;
  last_active_at: string | null;
  totals: {
    sessions_total: number;
    sessions_completed: number;
    exercises_total: number;
    exercises_completed: number;
    avg_score: number | null;
  };
  weeks: WeekProgress[];
  top_weak_areas: TagStat[];
  top_strengths: TagStat[];
  streak: StreakSummary;
  activity: ActivityDay[];
};

export type ReplanResponse = {
  changed: boolean;
  reason?: string;
  summary_note?: string;
  rewritten_weeks?: number;
  added_bonus_weeks?: number;
  total_weeks?: number;
};

// --- Admin dashboard ----------------------------------------------------

export type AdminOverview = {
  users: {
    total: number;
    signups_today: number;
    signups_7d: number;
    signups_30d: number;
    dau: number;
    wau: number;
    mau: number;
  };
  subscriptions: {
    by_tier: { free: number; pro: number; power: number };
    paying: number;
    mrr_cents: number;
    currency: string;
  };
  cost: {
    today_cents: number;
    last_30d_cents: number;
    currency: string;
  };
  margin: { last_30d_cents: number };
  tier_prices: { free: number; pro: number; power: number };
};

export type AdminUser = {
  id: string | null;
  email: string | null;
  created_at: string | null;
  tier: string;
  status: string;
  cost_cents_window: number;
};

export type AdminUsageAgent = {
  agent: string;
  cost_cents: number;
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
};

export type AdminUsage = {
  days: number;
  total_cost_cents: number;
  currency: string;
  series: { date: string; value: number }[];
  by_agent: AdminUsageAgent[];
  by_model: { model: string; cost_cents: number; calls: number }[];
};

export type AdminEngagement = {
  days: number;
  active_users_series: { date: string; value: number }[];
  sessions_completed_total: number;
};

export type AdminProfitMonth = {
  month: string;
  revenue_cents: number;
  cost_cents: number;
  margin_cents: number;
};

export type AdminProfit = { months: AdminProfitMonth[] };

// --- Subscription / tier (no payments yet — admin-grant only) -----------

export type Tier = "free" | "pro" | "power";

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "expired"
  | "grace"
  | "paused";

export type Subscription = {
  tier: Tier;
  status: SubscriptionStatus;
  current_period_end: string | null;
  started_at: string | null;
  monthly_price_cents: number;
  currency: string;
  /**
   * The tier the backend will apply to this request RIGHT NOW. Diverges
   * from `tier` when e.g. an active row's `current_period_end` has
   * lapsed — `_load_user_tier` in middleware/auth.py downgrades to
   * 'free' even though the row still says 'pro'. Use this for gating
   * decisions; show `tier` to the user.
   */
  effective_tier: Tier;
};

export type GrantTierBody = {
  user_id: string;
  tier: "pro" | "power";
  /** Days from now until current_period_end. Backend defaults to 30. */
  days?: number;
};

export type GrantTierResponse = {
  ok: true;
  subscription: {
    user_id: string;
    tier: Tier;
    status: SubscriptionStatus;
    current_period_end: string | null;
    monthly_price_cents: number;
    currency: string;
  };
};

/**
 * HTTP error thrown by `request()` for non-2xx responses. Carries the
 * raw status + parsed JSON body so call sites can branch on machine-
 * readable codes (e.g. `error === "tier_curriculum_cap"`) instead of
 * substring-matching the formatted message string.
 *
 * Inherits from `Error` so existing `.message`-based handlers keep
 * working — the message is still the same `"402 PAYMENT REQUIRED: ..."`
 * shape it used to be.
 */
export class ApiError extends Error {
  status: number;
  body: { error?: string; detail?: string; [k: string]: unknown };
  constructor(status: number, statusText: string, body: unknown) {
    const parsed = (typeof body === "object" && body !== null
      ? (body as { error?: string; detail?: string })
      : { detail: String(body ?? "") });
    super(`${status} ${statusText}: ${JSON.stringify(parsed)}`);
    this.name = "ApiError";
    this.status = status;
    this.body = parsed as ApiError["body"];
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep `text` as the body */
    }
    throw new ApiError(res.status, res.statusText, parsed);
  }
  return res.json() as Promise<T>;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  // Auth'd endpoints — pass a Supabase JWT
  me: (token: string) =>
    request<{ user_id: string; email: string }>("/auth/me", {
      headers: authHeaders(token),
    }),

  listCurricula: (token: string) =>
    request<{ curricula: CurriculumListItem[] }>("/curriculum", {
      headers: authHeaders(token),
    }),

  createCurriculum: (
    token: string,
    body: { goal: string; native_language?: string },
  ) =>
    request<AssessorStepResponse>("/curriculum", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  submitAssessorAnswer: (token: string, curriculumId: string, answer: string) =>
    request<AssessorStepResponse>(`/curriculum/${curriculumId}/assessor`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ answer }),
    }),

  getCurriculum: (token: string, curriculumId: string) =>
    request<Record<string, unknown>>(`/curriculum/${curriculumId}`, {
      headers: authHeaders(token),
    }),

  deleteCurriculum: (token: string, curriculumId: string) =>
    request<{ ok: boolean; id: string }>(`/curriculum/${curriculumId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  generatePlan: (token: string, curriculumId: string) =>
    request<PlanResponse>(`/curriculum/${curriculumId}/plan`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  getWeeks: (token: string, curriculumId: string) =>
    request<{ weeks: WeekRow[] }>(`/curriculum/${curriculumId}/weeks`, {
      headers: authHeaders(token),
    }),

  // --- Exercises ---

  listExercises: (
    token: string,
    curriculumId: string,
    weekId?: string,
  ) => {
    const qs = weekId ? `?week_id=${encodeURIComponent(weekId)}` : "";
    return request<{ exercises: ExerciseRow[] }>(
      `/curriculum/${curriculumId}/exercises${qs}`,
      { headers: authHeaders(token) },
    );
  },

  generateExercises: (
    token: string,
    curriculumId: string,
    body: {
      week_id?: string;
      count?: number;
      module_index?: number;
      // Bonus drill — every item targets one of the user's
      // recent_weak_areas tags. Rows are inserted with module_index=null.
      focus_weak_areas?: boolean;
    } = {},
  ) =>
    request<GenerateExercisesResponse>(
      `/curriculum/${curriculumId}/exercises`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(body),
      },
    ),

  // --- Lessons ---

  listLessons: (
    token: string,
    curriculumId: string,
    weekId?: string,
  ) => {
    const qs = weekId ? `?week_id=${encodeURIComponent(weekId)}` : "";
    return request<{ lessons: LessonRow[] }>(
      `/curriculum/${curriculumId}/lessons${qs}`,
      { headers: authHeaders(token) },
    );
  },

  generateLesson: (
    token: string,
    curriculumId: string,
    body: { week_id?: string; module_index?: number } = {},
  ) =>
    request<LessonRow>(`/curriculum/${curriculumId}/lessons`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  markLessonSeen: (token: string, lessonId: string) =>
    request<LessonRow>(`/curriculum/lessons/${lessonId}/seen`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  submitExercise: (
    token: string,
    exerciseId: string,
    submission: ExerciseSubmission,
  ) =>
    request<SubmitExerciseResponse>(
      `/curriculum/exercises/${exerciseId}/submit`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ submission }),
      },
    ),

  /**
   * Streaming variant of `submitExercise`. Returns an `AsyncIterable` so
   * callers can `for await (const frame of api.submitExerciseStream(...))`
   * and react to deltas as they arrive.
   *
   * Only used today for `short_answer` exercises — the `feedback` and
   * `gap` fields take seconds to generate and benefit from
   * token-by-token rendering. Multiple-choice and flashcards score
   * instantly and don't need streaming; the session screen falls back to
   * the non-streaming path for them.
   *
   * Backed by `react-native-sse` (added in step 6f). If the package
   * isn't installed yet the iterator yields a single `{ kind: "error" }`
   * frame and closes — call sites should fall back to `submitExercise`.
   */
  submitExerciseStream: (
    token: string,
    exerciseId: string,
    submission: ExerciseSubmission,
  ): AsyncIterable<SubmitStreamFrame> =>
    submitExerciseStream(token, exerciseId, submission),

  // --- Tracker / Adapter ---

  getDashboard: (token: string) =>
    request<DashboardSummary>("/curriculum/progress", {
      headers: authHeaders(token),
    }),

  getCurriculumProgress: (token: string, curriculumId: string) =>
    request<CurriculumProgressDetail>(
      `/curriculum/${curriculumId}/progress`,
      { headers: authHeaders(token) },
    ),

  replan: (token: string, curriculumId: string) =>
    request<ReplanResponse>(`/curriculum/${curriculumId}/replan`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  /**
   * "Add more sessions" — generate a bonus batch of exercises that
   * target the user's weak areas. No new weeks; inserts exercises with
   * module_index=null so the session screen groups them separately.
   */
  addMoreSessions: (token: string, curriculumId: string, weekId?: string) =>
    request<GenerateExercisesResponse>(
      `/curriculum/${curriculumId}/exercises`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          focus_weak_areas: true,
          count: 5,
          ...(weekId ? { week_id: weekId } : {}),
        }),
      },
    ),

  /**
   * "Make it harder" — replan upcoming weeks with an explicit difficulty
   * boost. Backed by the same Adapter as `replan` but injects an extra
   * instruction that raises the challenge ceiling across all upcoming weeks.
   * Pro+ only (backend returns 402 for free tier).
   */
  makeHarder: (token: string, curriculumId: string) =>
    request<ReplanResponse>(`/curriculum/${curriculumId}/replan`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ difficulty_boost: true }),
    }),

  // --- Admin (boian4934@gmail.com only — backend returns 404 otherwise) ---

  adminOverview: (token: string) =>
    request<AdminOverview>("/admin/overview", { headers: authHeaders(token) }),

  adminUsers: (token: string, days = 30) =>
    request<{ users: AdminUser[]; days: number }>(
      `/admin/users?days=${days}`,
      { headers: authHeaders(token) },
    ),

  adminUsage: (token: string, days = 30) =>
    request<AdminUsage>(`/admin/usage?days=${days}`, {
      headers: authHeaders(token),
    }),

  adminEngagement: (token: string, days = 30) =>
    request<AdminEngagement>(`/admin/engagement?days=${days}`, {
      headers: authHeaders(token),
    }),

  adminProfit: (token: string, months = 6) =>
    request<AdminProfit>(`/admin/profit?months=${months}`, {
      headers: authHeaders(token),
    }),

  // --- Manual subscription grants (admin only). RevenueCat takes over
  // these writes once the IAP webhook lands.

  adminGrantTier: (token: string, body: GrantTierBody) =>
    request<GrantTierResponse>("/admin/subscriptions/grant", {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  adminRevokeTier: (token: string, userId: string) =>
    request<GrantTierResponse>("/admin/subscriptions/revoke", {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }),

  // --- /me/subscription — what plan does THE CURRENT USER have? Used by
  // the home screen tier badge. Backend always returns 200 (synthesises
  // a free row when no subscriptions record exists).

  mySubscription: (token: string) =>
    request<Subscription>("/auth/me/subscription", {
      headers: authHeaders(token),
    }),
};

// --- SSE plumbing ---------------------------------------------------------
//
// react-native-sse's EventSource is callback-based; we wrap it in an
// AsyncIterable so the session screen can consume frames with a clean
// for-await loop and bail out via `break` (which triggers `return()` to
// close the underlying connection).
//
// Importing the package via a try/catch keeps the app booting even if
// the dependency hasn't been `npm install`-ed yet — same fall-back
// pattern as the `Gradient` component takes when expo-linear-gradient
// isn't there.

type RNEventSource = {
  addEventListener: (
    type: string,
    handler: (event: {
      type: string;
      data?: string | null;
      message?: string;
    }) => void,
  ) => void;
  close: () => void;
};

type RNEventSourceCtor = new (
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    pollingInterval?: number;
  },
) => RNEventSource;

let _EventSource: RNEventSourceCtor | null = null;
try {
  // Lazy require so a missing package doesn't crash module load.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _EventSource = require("react-native-sse").default as RNEventSourceCtor;
} catch (_e) {
  _EventSource = null;
}

function submitExerciseStream(
  token: string,
  exerciseId: string,
  submission: ExerciseSubmission,
): AsyncIterable<SubmitStreamFrame> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<SubmitStreamFrame> {
      // Fallback when react-native-sse isn't installed: emit one error
      // frame so the caller can fall back to the non-streaming path.
      if (!_EventSource) {
        let yielded = false;
        return {
          async next() {
            if (yielded) {
              return { value: undefined as never, done: true };
            }
            yielded = true;
            return {
              value: {
                kind: "error",
                error: "sse_unavailable",
                detail: "react-native-sse not installed",
              } as SubmitStreamFrame,
              done: false,
            };
          },
          async return() {
            return { value: undefined as never, done: true };
          },
        };
      }

      const url = `${BASE_URL}/curriculum/exercises/${exerciseId}/submit/stream`;
      const queue: SubmitStreamFrame[] = [];
      const waiters: Array<
        (v: IteratorResult<SubmitStreamFrame>) => void
      > = [];
      let closed = false;

      const es = new _EventSource(url, {
        method: "POST",
        headers: {
          ...authHeaders(token),
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ submission }),
        pollingInterval: 0, // one-shot stream, no polling
      });

      const push = (frame: SubmitStreamFrame) => {
        if (closed) return;
        const waiter = waiters.shift();
        if (waiter) {
          waiter({ value: frame, done: false });
        } else {
          queue.push(frame);
        }
      };

      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          es.close();
        } catch (_e) {
          // best-effort cleanup
        }
        while (waiters.length) {
          const w = waiters.shift();
          if (w) w({ value: undefined as never, done: true });
        }
      };

      es.addEventListener("delta", (event) => {
        try {
          const data = JSON.parse(event.data ?? "{}");
          push({
            kind: "delta",
            snapshot: (data.snapshot ?? {}) as EvaluatorSnapshot,
          });
        } catch (_e) {
          // Ignore — a malformed delta isn't fatal.
        }
      });

      es.addEventListener("done", (event) => {
        try {
          const payload = JSON.parse(
            event.data ?? "{}",
          ) as SubmitExerciseResponse;
          push({ kind: "done", payload });
        } catch (e) {
          push({
            kind: "error",
            error: "bad_done_frame",
            detail: (e as Error).message,
          });
        }
        finish();
      });

      // SSE protocol: a server-emitted `event: error\ndata: {...}` frame
      // arrives via the same listener as a transport-level error in
      // react-native-sse. We try to parse the data as our error envelope;
      // if that fails we surface the transport message instead.
      es.addEventListener("error", (event) => {
        let frame: SubmitStreamFrame = {
          kind: "error",
          error: "stream_error",
          detail: event?.message ?? "connection error",
        };
        if (event?.data) {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && typeof parsed === "object") {
              frame = {
                kind: "error",
                error: parsed.error ?? "stream_error",
                detail: parsed.detail,
              };
            }
          } catch (_e) {
            // keep transport-error frame
          }
        }
        push(frame);
        finish();
      });

      return {
        async next() {
          if (queue.length) {
            return {
              value: queue.shift() as SubmitStreamFrame,
              done: false,
            };
          }
          if (closed) {
            return { value: undefined as never, done: true };
          }
          return new Promise<IteratorResult<SubmitStreamFrame>>((resolve) => {
            waiters.push(resolve);
          });
        },
        async return() {
          finish();
          return { value: undefined as never, done: true };
        },
      };
    },
  };
}

export { BASE_URL };
