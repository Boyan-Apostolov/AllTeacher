import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Best-effort device locale → 2-letter BCP-47 language code. Works without
 * expo-localization by falling back through Intl and the iOS native module.
 */
function detectLanguage(): string {
  // 1. Intl (present in Hermes).
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    if (loc) return loc.split("-")[0].toLowerCase();
  } catch {}
  // 2. iOS native settings.
  if (Platform.OS === "ios") {
    const s = NativeModules.SettingsManager?.settings;
    const raw: string | undefined =
      s?.AppleLocale || s?.AppleLanguages?.[0];
    if (raw) return raw.split(/[-_]/)[0].toLowerCase();
  }
  return "en";
}

/** A small set of popular native languages. Free-text override available. */
const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "bg", label: "Български" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "ro", label: "Română" },
  { code: "tr", label: "Türkçe" },
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
];

/**
 * New curriculum entry screen.
 *
 * User types a free-form goal (any language), picks their native language,
 * we POST it to /curriculum and the backend kicks off the Assessor. We
 * then push into /curriculum/[id] which drives the MCQ loop.
 */
export default function NewCurriculumScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const defaultLang = useMemo(detectLanguage, []);
  const [goal, setGoal] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState(defaultLang);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    const token = session?.access_token;
    if (!token) {
      setError("Not signed in");
      return;
    }
    const trimmed = goal.trim();
    if (!trimmed) {
      setError("Please describe what you want to learn.");
      return;
    }
    const lang = (nativeLanguage || "en").trim().toLowerCase();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createCurriculum(token, {
        goal: trimmed,
        native_language: lang,
      });
      router.replace(`/curriculum/${res.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "New curriculum" }} />
      <View style={styles.toolbar}>
        <Pressable
          style={styles.toolbarBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          disabled={submitting}
        >
          <Text style={styles.toolbarBtnText}>← Back</Text>
        </Pressable>
        <Pressable
          style={styles.toolbarBtn}
          onPress={() => router.replace("/")}
          disabled={submitting}
        >
          <Text style={styles.toolbarBtnText}>Home</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>What do you want to learn?</Text>
          <Text style={styles.subtitle}>
            Write it in any language — a topic, skill, or goal. The Assessor
            will ask a few questions and build your curriculum.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Your goal</Text>
            <TextInput
              style={styles.textarea}
              placeholder="e.g. Learn conversational Italian for a trip this summer"
              placeholderTextColor="#999"
              multiline
              autoFocus
              value={goal}
              onChangeText={setGoal}
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              I want the questions in (your native language)
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {LANGUAGES.map((l) => {
                const active = l.code === nativeLanguage;
                return (
                  <Pressable
                    key={l.code}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setNativeLanguage(l.code)}
                    disabled={submitting}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {l.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextInput
              style={styles.input}
              placeholder="or type a language code (e.g. sv, el)"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              value={nativeLanguage}
              onChangeText={setNativeLanguage}
              editable={!submitting}
            />
            <Text style={styles.hint}>
              Detected from your device: {defaultLang}
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primary, submitting && styles.primaryDisabled]}
            onPress={start}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Start assessment</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => router.back()}
            disabled={submitting}
          >
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fafafa",
  },
  toolbarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toolbarBtnText: { fontSize: 15, color: "#0a84ff", fontWeight: "600" },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: "700" },
  subtitle: { fontSize: 15, color: "#555", marginBottom: 8 },
  field: { gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textarea: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  chipActive: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  chipText: { fontSize: 14, color: "#222" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  hint: { fontSize: 12, color: "#888" },
  error: { color: "#c0392b", fontSize: 14 },
  primary: {
    marginTop: 8,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondary: {
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: { color: "#666", fontSize: 15 },
});
