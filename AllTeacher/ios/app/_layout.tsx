import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Slot, usePathname, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { BottomTabBar } from "@/components/ui";
import { configureRevenueCat, identifyUser, resetUser } from "@/lib/revenuecat";

// Routes that should show the persistent bottom tab bar
const TAB_ROUTES = new Set(["/", "/progress", "/vocabulary", "/subscription"]);

/**
 * Gate wraps the routed screens and redirects based on session state:
 *   - no session + not in (auth) → /(auth)/login
 *   - session + in (auth)        → /         (home)
 *
 * Also ties the RevenueCat identity to the Supabase user so purchases
 * are attributed to the right account in the dashboard.
 */
function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  // Sync RevenueCat identity whenever the auth session changes
  useEffect(() => {
    if (session?.user?.id) {
      identifyUser(session.user.id);
    } else if (!loading && !session) {
      resetUser();
    }
  }, [session?.user?.id, loading]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/");
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const showTabBar = !!session && TAB_ROUTES.has(pathname);

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {showTabBar ? <BottomTabBar /> : null}
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    configureRevenueCat();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Gate />
    </AuthProvider>
  );
}
