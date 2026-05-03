/**
 * Signup screen — collects email + password (>= 6 chars) and calls
 * auth.signUp. Also supports "Continue with Apple" via expo-apple-authentication
 * (skips the email/password flow entirely — Apple provides the identity).
 */
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";

import { useAuth } from "@/lib/auth";
import {
  Field,
  MessageBox,
  PrimaryCta,
  ScreenContainer,
} from "@/components/ui";
import { colors, radii, spacing, type } from "@/lib/theme";

import { authStyles as styles } from "./auth.styles";

export default function Signup() {
  const { signUp, signInWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    import("expo-apple-authentication").then((mod) => {
      mod.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    });
  }, []);

  const onSubmit = async () => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await signUp(email.trim(), password);
      setInfo(
        "Account created. If email confirmation is enabled, check your inbox.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onApple = async () => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await signInWithApple();
    } catch (e: any) {
      if (e?.code !== "ERR_CANCELED") {
        const msg = e?.message || e?.toString() || "Apple Sign In failed";
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!email && password.length >= 6 && !submitting;

  return (
    <ScreenContainer
      gradient={{
        from: colors.accent,
        via: colors.brand,
        to: "#5fb8ff",
        angle: 200,
        height: 360,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={signupStyles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>AllTeacher</Text>
          <Text style={styles.heroTitle}>Learn{"\n"}anything 🌱</Text>
          <Text style={styles.heroSub}>
            Tell us a goal — we'll build the path.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={type.h1}>Create account</Text>
          <Text style={styles.cardSub}>
            No credit card. One curriculum on the free plan.
          </Text>

          {/* Apple button first — Apple guidelines require it to be prominent */}
          {appleAvailable ? (
            <AppleSignUpButton
              onPress={onApple}
              disabled={submitting}
            />
          ) : null}

          {/* — or — divider before email/password */}
          {appleAvailable ? (
            <View style={appleStyles.dividerRow}>
              <View style={appleStyles.line} />
              <Text style={appleStyles.orText}>or sign up with email</Text>
              <View style={appleStyles.line} />
            </View>
          ) : null}

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
              placeholder="At least 6 characters"
              value={password}
              onChangeText={setPassword}
              focused={focused === "password"}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </View>

          {error ? (
            <View style={styles.errorWrap}>
              <MessageBox variant="error" message={error} />
            </View>
          ) : null}
          {info ? (
            <View style={styles.errorWrap}>
              <MessageBox variant="success" message={info} />
            </View>
          ) : null}

          <View style={styles.ctaWrap}>
            <PrimaryCta
              label="Create account →"
              onPress={onSubmit}
              loading={submitting}
              disabled={!canSubmit}
              from={colors.brand}
              to={colors.accent}
            />
          </View>

          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.footerLink}>
              <Text style={styles.footer}>
                Already have one?{" "}
                <Text style={styles.footerAccent}>Sign in</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

/** Apple "Continue with Apple" button — lazy-loaded, only rendered when available. */
function AppleSignUpButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  const [AppleAuthentication, setMod] = useState<any>(null);

  useEffect(() => {
    import("expo-apple-authentication").then(setMod).catch(() => {});
  }, []);

  if (!AppleAuthentication) return null;

  return (
    <View style={appleStyles.buttonWrap}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={radii.lg}
        style={appleStyles.button}
        onPress={onPress}
      />
    </View>
  );
}

const signupStyles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "flex-end" },
});

const appleStyles = StyleSheet.create({
  buttonWrap: { marginTop: spacing.lg },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontSize: 12, color: colors.textMuted, flexShrink: 0 },
  button: { height: 50, width: "100%" },
});
