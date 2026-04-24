import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, BASE_URL, type HealthResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user, session, signOut } = useAuth();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [meOk, setMeOk] = useState<boolean | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .health()
      .then((h) => !cancelled && setHealth(h))
      .catch((e: Error) => !cancelled && setHealthError(e.message));

    // Prove the backend can verify our Supabase JWT.
    if (session?.access_token) {
      api
        .me(session.access_token)
        .then(() => !cancelled && setMeOk(true))
        .catch((e: Error) => {
          if (cancelled) return;
          setMeOk(false);
          setMeError(e.message);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>AllTeacher</Text>
        <Text style={styles.subtitle}>Signed in as {user?.email}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>API URL</Text>
          <Text style={styles.value}>{BASE_URL}</Text>
        </View>

        {healthError ? (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.label}>/health error</Text>
            <Text style={styles.value}>{healthError}</Text>
          </View>
        ) : health ? (
          <View style={[styles.card, styles.cardOk]}>
            <Text style={styles.label}>/health</Text>
            <Text style={styles.value}>
              {health.status} ({health.env})
            </Text>
            <Text style={styles.value}>
              Supabase: {health.configured.supabase ? "✓" : "—"}
              {"   "}
              OpenAI: {health.configured.openai ? "✓" : "—"}
              {"   "}
              RevenueCat: {health.configured.revenuecat ? "✓" : "—"}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <ActivityIndicator />
            <Text style={styles.hint}>Calling /health…</Text>
          </View>
        )}

        {meOk === true ? (
          <View style={[styles.card, styles.cardOk]}>
            <Text style={styles.label}>/auth/me</Text>
            <Text style={styles.value}>JWT verified by backend ✓</Text>
          </View>
        ) : meOk === false ? (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.label}>/auth/me error</Text>
            <Text style={styles.value}>{meError}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <ActivityIndicator />
            <Text style={styles.hint}>Verifying JWT with backend…</Text>
          </View>
        )}

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: "700" },
  subtitle: { fontSize: 15, color: "#666", marginBottom: 8 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    gap: 6,
  },
  cardOk: { borderColor: "#b7eb8f", backgroundColor: "#f6ffed" },
  cardError: { borderColor: "#ffa39e", backgroundColor: "#fff1f0" },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
  },
  value: { fontSize: 15, color: "#222" },
  hint: { fontSize: 13, color: "#888", marginTop: 4 },
  signOutButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  signOutText: { fontSize: 15, color: "#c0392b", fontWeight: "600" },
});
