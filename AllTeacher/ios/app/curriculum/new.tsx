/**
 * Create-curriculum screen — collects the user's goal + native language,
 * then kicks off the assessor by calling api.createCurriculum. Mostly
 * presentational; relies on shared UI primitives (Toolbar, PrimaryCta,
 * MessageBox, ScreenContainer) and the LanguagePicker.
 */
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LanguagePicker } from "@/components/curriculum";
import {
  MessageBox,
  PrimaryCta,
  ScreenContainer,
  Toolbar,
} from "@/components/ui";
import { colors } from "@/lib/theme";

import { newCurriculumStyles as styles } from "./new.styles";

/** Best-effort device locale → 2-letter BCP-47 language code. */
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
      // Tier-cap rejections (402 tier_curriculum_cap) are user-actionable,
      // not bugs — surface them as an Alert with the upgrade message
      // straight from the backend instead of dropping a "402" string into
      // the generic error MessageBox.
      if (e instanceof ApiError && e.body?.error === "tier_curriculum_cap") {
        Alert.alert(
          "Plan limit reached",
          e.body.detail ||
            "Your plan supports a limited number of active curricula. Archive an existing track or upgrade to start a new one.",
          [{ text: "OK" }],
        );
      } else {
        setError((e as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  const goHome = () => router.replace("/");

  return (
    <ScreenContainer
      gradient={{
        from: colors.brand,
        via: colors.accent,
        to: "#ff9966",
        angle: 155,
        height: 280,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Toolbar
        title="New curriculum"
        onBack={goBack}
        onHome={goHome}
        disabled={submitting}
      />

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
            <LanguagePicker
              value={nativeLanguage}
              onChange={setNativeLanguage}
              disabled={submitting}
              detectedHint={`Detected from your device: ${defaultLang}`}
            />
          </View>

          {error ? <MessageBox variant="error" message={error} /> : null}

          <PrimaryCta
            label="Start assessment →"
            onPress={start}
            loading={submitting}
            disabled={submitting}
          />

          <Pressable
            style={styles.cancel}
            onPress={goBack}
            disabled={submitting}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
