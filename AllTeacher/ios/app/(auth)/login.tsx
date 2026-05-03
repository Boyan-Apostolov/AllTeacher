/**
 * Login screen — collects email + password and calls auth.signIn.
 * Also supports "Sign in with Apple" via expo-apple-authentication.
 */
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
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

export default function Login() {
  const { signIn, signInWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onApple = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithApple();
      // On success the auth state change fires and the router redirects —
      // no need to set any state here.
    } catch (e: any) {
      // ERR_CANCELED is thrown when the user dismisses the sheet — not an error.
      if (e?.code !== "ERR_CANCELED") {
        const msg = e?.message || e?.toString() || "Apple Sign In failed";
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!email && !!password && !submitting;

  return (
    <ScreenContainer
      gradient={{
        from: colors.brand,
        via: colors.accent,
        to: "#ff9966",
        angle: 150,
        height: 360,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={loginStyles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>AllTeacher</Text>
          <Text style={styles.heroTitle}>Welcome{"\n"}back ✨</Text>
          <Text style={styles.heroSub}>Pick up where you left off.</Text>
        </View>

        <View style={styles.card}>
          <Text style={type.h1}>Sign in</Text>
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

          {error ? (
            <View style={styles.errorWrap}>
              <MessageBox variant="error" message={error} />
            </View>
          ) : null}

          <View style={styles.ctaWrap}>
            <PrimaryCta
              label="Sign in →"
              onPress={onSubmit}
              loading={submitting}
              disabled={!canSubmit}
            />
          </View>

          {appleAvailable ? (
            <AppleDividerAndButton onPress={onApple} disabled={submitting} />
          ) : null}

          <Link href="/(auth)/signup" asChild>
            <Pressable style={styles.footerLink}>
              <Text style={styles.footer}>
                New here?{" "}
                <Text style={styles.footerAccent}>Create an account</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

/** Divider + Apple button — rendered only when Apple Sign In is available. */
function AppleDividerAndButton({
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
    <View style={appleStyles.wrap}>
      {/* — or — */}
      <View style={appleStyles.dividerRow}>
        <View style={appleStyles.line} />
        <Text style={appleStyles.orText}>or</Text>
        <View style={appleStyles.line} />
      </View>

      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={radii.lg}
        style={appleStyles.button}
        onPress={onPress}
      />
    </View>
  );
}

const loginStyles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "flex-end" },
});

const appleStyles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontSize: 13, color: colors.textMuted },
  button: { height: 50, width: "100%" },
});
