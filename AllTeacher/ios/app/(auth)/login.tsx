import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Gradient } from "@/components/Gradient";
import { colors, radii, shadow, spacing, type } from "@/lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!email && !!password && !submitting;

  return (
    <View style={styles.root}>
      <Gradient
        from={colors.brand}
        via={colors.accent}
        to="#ff9966"
        angle={150}
        style={styles.bgGradient}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>AllTeacher</Text>
            <Text style={styles.heroTitle}>Welcome{"\n"}back ✨</Text>
            <Text style={styles.heroSub}>Pick up where you left off.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardSub}>Use the email you signed up with.</Text>

            <View style={styles.fields}>
              <Field
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                focused={focused === "email"}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <Field
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                focused={focused === "password"}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
              />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              disabled={!canSubmit}
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.cta,
                !canSubmit && styles.ctaDisabled,
                pressed && canSubmit && styles.ctaPressed,
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
                  <Text style={styles.ctaText}>Sign in →</Text>
                )}
              </Gradient>
            </Pressable>

            <Link href="/(auth)/signup" asChild>
              <Pressable style={styles.footerLink}>
                <Text style={styles.footer}>
                  New here?{" "}
                  <Text style={styles.footerAccent}>Create an account</Text>
                </Text>
              </Pressable>
            </Link>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({
  label,
  focused,
  ...rest
}: React.ComponentProps<typeof TextInput> & { label: string; focused: boolean }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, focused && styles.inputFocused]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgGradient: { ...StyleSheet.absoluteFillObject, height: 360 },
  safe: { flex: 1 },
  flex: { flex: 1 },

  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.8,
    lineHeight: 44,
  },
  heroSub: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    marginTop: spacing.md,
  },

  card: {
    marginHorizontal: spacing.lg,
    marginTop: "auto",
    marginBottom: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...shadow.raised,
  },
  cardTitle: { ...type.h1 },
  cardSub: { ...type.bodyMuted, marginTop: spacing.xs },
  fields: { gap: spacing.md, marginTop: spacing.lg },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.brand,
    backgroundColor: colors.surface,
  },

  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
  },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "600" },

  cta: {
    marginTop: spacing.lg,
    borderRadius: radii.pill,
    overflow: "hidden",
    ...shadow.card,
  },
  ctaGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: { transform: [{ scale: 0.98 }] },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.textOnDark, fontSize: 17, fontWeight: "800" },

  footerLink: { marginTop: spacing.lg, alignSelf: "center" },
  footer: { fontSize: 14, color: colors.textMuted },
  footerAccent: { color: colors.brand, fontWeight: "700" },
});
