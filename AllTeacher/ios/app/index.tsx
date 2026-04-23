import { useEffect, useState } from "react";
import { StyleSheet, Text, View, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, BASE_URL, type HealthResponse } from "@/lib/api";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>AllTeacher</Text>
        <Text style={styles.subtitle}>Backend connectivity check</Text>

        <View style={styles.card}>
          <Text style={styles.label}>API URL</Text>
          <Text style={styles.value}>{BASE_URL}</Text>
        </View>

        {loading && (
          <View style={styles.card}>
            <ActivityIndicator />
            <Text style={styles.hint}>Calling /health…</Text>
          </View>
        )}

        {error && (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.label}>Error</Text>
            <Text style={styles.value}>{error}</Text>
            <Text style={styles.hint}>
              Is the backend running? From /backend: python app.py
            </Text>
          </View>
        )}

        {health && (
          <View style={[styles.card, styles.cardOk]}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>
              {health.status} ({health.env})
            </Text>
            <Text style={styles.label}>Integrations configured</Text>
            <Text style={styles.value}>
              Supabase: {health.configured.supabase ? "✓" : "—"}
              {"   "}
              OpenAI: {health.configured.openai ? "✓" : "—"}
              {"   "}
              RevenueCat: {health.configured.revenuecat ? "✓" : "—"}
            </Text>
          </View>
        )}
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
  label: { fontSize: 12, fontWeight: "600", color: "#888", textTransform: "uppercase" },
  value: { fontSize: 15, color: "#222" },
  hint: { fontSize: 13, color: "#888", marginTop: 4 },
});
