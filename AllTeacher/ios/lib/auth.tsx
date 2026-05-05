/**
 * Auth context — wraps the app, exposes `useAuth()` everywhere.
 *
 *   const { session, user, loading, signIn, signUp, signOut, signInWithApple } = useAuth();
 *
 * Session is the Supabase Session object (null when logged out).
 * `loading` is true only on initial hydration from AsyncStorage.
 */
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithApple: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hydrate session from AsyncStorage on mount.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // React to sign-in / sign-out / token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signUp: async (email, password) => {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    signInWithApple: async () => {
      if (Platform.OS !== "ios") throw new Error("Apple Sign In is only available on iOS");

      // Lazy import so the module is never required on non-iOS builds.
      const AppleAuthentication = await import("expo-apple-authentication");

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple Sign In failed: no identity token returned");
      }

      console.log("[Apple] identityToken present:", !!credential.identityToken);
      console.log("[Apple] identityToken (first 80):", credential.identityToken?.slice(0, 80));

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      console.log("[Apple] signInWithIdToken error:", JSON.stringify(error));
      console.log("[Apple] signInWithIdToken session:", !!data?.session);
      console.log("[Apple] signInWithIdToken user:", data?.user?.id);

      if (error) throw error;
      if (!data.session) throw new Error("Apple Sign In: no session returned from Supabase");

      // onAuthStateChange doesn't always fire for signInWithIdToken in React
      // Native — explicitly set the session so the Gate redirect fires.
      setSession(data.session);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Single-operator admin gate. Backend ALSO checks (via @admin_only +
// ADMIN_EMAIL) so this is purely a UX hint — non-admins can never
// load /admin/* even if they craft a request manually.
export const ADMIN_EMAIL = "boian4934@gmail.com";

export function useAdmin(): boolean {
  const { user } = useAuth();
  return (user?.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
