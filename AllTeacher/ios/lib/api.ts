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

export const api = {
  health: () => request<HealthResponse>("/health"),

  // Auth'd endpoints — pass a Supabase JWT
  me: (token: string) =>
    request<{ user_id: string; email: string }>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export { BASE_URL };
