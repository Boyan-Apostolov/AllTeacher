import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  api,
  BASE_URL,
  type CurriculumListItem,
  type HealthResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const { user, session, signOut } = useAuth();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [meOk, setMeOk] = useState<boolean | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [curricula, setCurricula] = useState<CurriculumListItem[] | null>(null);
  const [curriculaError, setCurriculaError] = useState<string | null>(null);

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

  // Refresh the curriculum list every time we come back to Home.
  useFocusEffect(
    useCallback(() => {
      if (!session?.access_token) return;
      let cancelled = false;
      setCurriculaError(null);
      api
        .listCurricula(session.access_token)
        .then((res) => !cancelled && setCurricula(res.curricula))
        .catch((e: Error) => !cancelled && setCurriculaError(e.message));
      return () => {
        cancelled = true;
      };
    }, [session?.access_token]),
  );

  const removeCurriculum = (c: CurriculumListItem) => {
    if (!session?.access_token) return;
    const token = session.access_token;
    const label = c.goal || c.topic || "this curriculum";
    Alert.alert(
      "Remove curriculum?",
      `“${label}” and all its data will be deleted. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            // Optimistic update.
            setCurricula((prev) =>
              prev ? prev.filter((x) => x.id !== c.id) : prev,
            );
            try {
              await api.deleteCurriculum(token, c.id);
            } catch (e) {
              // Re-fetch on failure to restore truth.
              setCurriculaError((e as Error).message);
              try {
                const res = await api.listCurricula(token);
                setCurricula(res.curricula);
              } catch {
                /* ignore */
              }
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>AllTeacher</Text>
        <Text style={styles.subtitle}>Signed in as {user?.email}</Text>

        <Pressable
          style={styles.primary}
          onPress={() => router.push("/curriculum/new")}
        >
          <Text style={styles.primaryText}>Start new curriculum</Text>
        </Pressable>

        <View style={{ gap: 8 }}>
          <Text style={styles.sectionHeader}>Your curricula</Text>
          {curriculaError ? (
            <View style={[styles.card, styles.cardError]}>
              <Text style={styles.value}>{curriculaError}</Text>
            </View>
          ) : curricula === null ? (
            <View style={styles.card}>
              <ActivityIndicator />
            </View>
          ) : curricula.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.value}>
                No curricula yet. Tap “Start new curriculum” to begin.
              </Text>
            </View>
          ) : (
            curricula.map((c) => (
              <View key={c.id} style={styles.curriculumRow}>
                <Pressable
                  style={styles.curriculumBody}
                  onPress={() => router.push(`/curriculum/${c.id}`)}
                >
                  <Text style={styles.curriculumTitle} numberOfLines={2}>
                    {c.goal || c.topic || "Untitled"}
                  </Text>
                  <Text style={styles.curriculumMeta}>
                    {c.assessor_status === "complete"
                      ? `Assessed${c.level ? ` · ${c.level}` : ""}${
                          c.domain ? ` · ${c.domain}` : ""
                        }`
                      : c.assessor_status === "in_progress"
                      ? "Assessment in progress"
                      : "New"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removeCurriculum(c)}
                  hitSlop={8}
                >
                  <Text style={styles.removeBtnText}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionHeader}>Diagnostics</Text>

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
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    marginTop: 8,
  },
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
  primary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  curriculumRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
  },
  curriculumBody: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  curriculumTitle: { fontSize: 16, fontWeight: "600", color: "#222" },
  curriculumMeta: { fontSize: 13, color: "#666" },
  removeBtn: {
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#eee",
    backgroundColor: "#fff5f5",
  },
  removeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#c0392b",
  },
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
