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
  | "essay_prompt";

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

// --- Lessons (Explainer) — short adaptive intro before each module ---

export type LessonContent = {
  concept_title: string;
  intro: string;
  key_points: string[];
  example: string;
  pitfalls: string[];
  next_up: string;
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
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
};

export { BASE_URL };
