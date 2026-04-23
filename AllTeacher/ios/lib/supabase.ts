/**
 * Supabase client — stub for now.
 *
 * When wiring auth, install:
 *   npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
 *
 * Then replace the stub below with a real createClient() call.
 */

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = {
  // Stub — replace with real client once @supabase/supabase-js is installed.
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signUp: async (_: unknown) => {
      throw new Error("supabase not wired yet — install @supabase/supabase-js");
    },
    signInWithPassword: async (_: unknown) => {
      throw new Error("supabase not wired yet — install @supabase/supabase-js");
    },
    signOut: async () => ({ error: null }),
  },
};
