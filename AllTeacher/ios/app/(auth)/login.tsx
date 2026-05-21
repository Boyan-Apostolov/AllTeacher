/**
 * Login screen — collects email + password and calls auth.signIn. Slim:
 * the input row, error box, and CTA are shared primitives.
 */
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { colors, type } from "@/lib/theme";

import { authStyles as styles } from "./auth.styles";

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
    </ScreenContainer>
  );
}
