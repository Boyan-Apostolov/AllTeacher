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
import { Gradient } from "@/components/Gradient";
import { colors, radii, shadow, spacing, type } from "@/lib/theme";

/**
 * Best-effort device locale → 2-letter BCP-47 language code.
 */
function detectLanguage(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    if (loc) return loc.split("-")[0].toLowerCase();
  } catch {}
  if (Platform.OS === "ios") {
    const s = NativeModules.SettingsManager?.settings;
    const raw: string | undefined =
      s?.AppleLocale || s?.AppleLanguages?.[0];
    if (raw) return raw.split(/[-_]/)[0].toLowerCase();
  }
  return "en";
}

const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "bg", label: "Български", flag: "🇧🇬" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "ro", label: "Română", flag: "🇷🇴" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
];

const SUGGESTIONS = [
  "Conversational Italian for a summer trip",
  "Python — basics to building a small web app",
  "Jazz piano improvisation",
  "GMAT quant in 6 weeks",
  "Watercolor painting for absolute beginners",
];

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
      setError("Tell us what you want to learn first.");
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

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <Gradient
        from={colors.brand}
        via={colors.accent}
        to="#ff9966"
        angle={155}
        style={styles.bgGradient}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.toolbar}>
          <Pressable
            style={styles.toolbarBtn}
            onPress={goBack}
            disabled={submitting}
          >
            <Text style={styles.toolbarBtnText}>← Back</Text>
          </Pressable>
          <Text style={styles.toolbarTitle}>New curriculum</Text>
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
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>Step 1 of 2 · The goal</Text>
            <Text style={styles.title}>What do you want{"\n"}to learn? 🚀</Text>
            <Text style={styles.subtitle}>
              Write a topic, skill, or goal — in any language. We'll ask a few
              quick questions and build your curriculum.
            </Text>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Your goal</Text>
              <TextInput
                style={styles.textarea}
                placeholder="e.g. Conversational Italian for a summer trip"
                placeholderTextColor={colors.textFaint}
                multiline
                autoFocus
                value={goal}
                onChangeText={setGoal}
                editable={!submitting}
              />
              <Text style={styles.suggestionsLabel}>Need inspiration?</Text>
              <View style={styles.suggestionsWrap}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    style={styles.suggestionChip}
                    onPress={() => setGoal(s)}
                    disabled={submitting}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Your native language</Text>
              <Text style={styles.fieldHint}>
                Questions and feedback will arrive in this language.
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
                      <Text style={styles.chipFlag}>{l.flag}</Text>
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
                placeholder="or type a code: sv, el, vi…"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                value={nativeLanguage}
                onChangeText={setNativeLanguage}
                editable={!submitting}
              />
              <Text style={styles.fieldHint}>
                Detected from your device: {defaultLang}
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={submitting}
              onPress={start}
              style={({ pressed }) => [
                styles.cta,
                submitting && styles.ctaDisabled,
                pressed && !submitting && styles.ctaPressed,
              ]}
            >
              <Gradient
                from={colors.brand}
                to={colors.brandDeep}
                angle={135}
                style={styles.ctaGradient}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textOnDark} />
                ) : (
                  <Text style={styles.ctaText}>Start assessment →</Text>
                )}
              </Gradient>
            </Pressable>

            <Pressable
              style={styles.cancel}
              onPress={goBack}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgGradient: { ...StyleSheet.absoluteFillObject, height: 280 },
  safe: { flex: 1 },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toolbarBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  toolbarBtnText: {
    fontSize: 14,
    color: colors.textOnDark,
    fontWeight: "700",
  },
  toolbarTitle: {
    color: colors.textOnDark,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: spacing.md,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.6,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 22,
    marginBottom: spacing.sm,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  fieldHint: { fontSize: 13, color: colors.textMuted },

  textarea: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 110,
    textAlignVertical: "top",
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },

  suggestionsLabel: {
    ...type.label,
    marginTop: spacing.sm,
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
  },
  suggestionText: {
    fontSize: 13,
    color: colors.brandDeep,
    fontWeight: "600",
  },

  chipsRow: {
    gap: spacing.sm,
    paddingVertical: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  chipFlag: { fontSize: 14 },
  chipText: { fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.brandDeep, fontWeight: "700" },

  errorBox: {
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
  },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "600" },

  cta: {
    borderRadius: radii.pill,
    overflow: "hidden",
    ...shadow.raised,
  },
  ctaGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: { transform: [{ scale: 0.98 }] },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.textOnDark, fontSize: 17, fontWeight: "800" },

  cancel: { paddingVertical: spacing.md, alignItems: "center" },
  cancelText: { color: colors.textOnDark, fontSize: 14, fontWeight: "600" },
});
