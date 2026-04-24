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
  level: string | null;
  created_at: string;
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
};

export { BASE_URL };
