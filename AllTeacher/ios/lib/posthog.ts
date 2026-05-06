/**
 * PostHog singleton — analytics + diagnostics.
 *
 * Initialised once at module load; used directly in components via the
 * `usePostHog()` hook (from the PostHogProvider in _layout.tsx) or via
 * the exported `posthog` instance for fire-and-forget calls outside of
 * React (e.g. in plain async functions).
 *
 * Key events we capture:
 *   curriculum_created   — user submits a new learning goal
 *   session_started      — session screen bootstrapped + ready
 *   lesson_viewed        — user taps "Start exercises" (lesson was read)
 *   exercise_submitted   — user submits one answer  { type, score, verdict }
 *   session_completed    — user reaches the finished screen
 *
 * PostHog auto-captures:
 *   Application Opened / Backgrounded, screen views (via captureScreens),
 *   app version, build, device model, OS version, locale, timezone.
 */
import PostHog from "posthog-react-native";

export const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  {
    host: "https://us.i.posthog.com",
    // Flush events every 20 seconds or when 20 are queued — sensible for
    // a mobile app that spends long stretches offline.
    flushInterval: 20000,
    flushAt: 20,
    // Keep the session alive for 30 minutes of inactivity.
    sessionExpirationTimeSeconds: 1800,
  },
);
