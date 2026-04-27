/**
 * Signup screen — collects email + password (>= 6 chars) and calls
 * auth.signUp. Shares chrome and primitives with login.tsx.
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

export default function Signup() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);

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
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
