/**
 * Signup screen — neo-brutalist redesign.
 * Step stickers, "Let's get you started." heading, brutalist fields.
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
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import { Field, MessageBox, PrimaryCta } from "@/components/ui";
import { Sticker } from "@/components/ui/Sticker";
import { colors, radii, spacing } from "@/lib/theme";

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
  const [weeklyEmails, setWeeklyEmails] = useState(true);

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
      setInfo("Account created! Check your inbox if email confirmation is enabled.");
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
        setError(e?.message || e?.toString() || "Apple Sign In failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!email && password.length >= 6 && !submitting;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={localStyles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Step stickers */}
            <View style={[styles.stepsRow, { marginTop: 20 }]}>
              <Sticker bg={colors.flash} color="#fff" rotate={-3}>step 1 of 3</Sticker>
              <Sticker bg={colors.paperAlt} color={colors.ink3} rotate={2} style={{ opacity: 0.7 }}>2</Sticker>
              <Sticker bg={colors.paperAlt} color={colors.ink3} rotate={-2} style={{ opacity: 0.7 }}>3</Sticker>
            </View>

            {/* Heading */}
            <View style={{ marginTop: 20 }}>
              <Text style={styles.heroTitle}>
                Let's get you{"\n"}
                <Text style={styles.heroTitleAccent}>started.</Text>
              </Text>
            </View>

            {/* Apple button first (Apple guidelines) */}
            {appleAvailable ? (
              <AppleSignUpButton onPress={onApple} disabled={submitting} />
            ) : null}

            {appleAvailable ? (
              <View style={appleStyles.dividerRow}>
                <View style={appleStyles.line} />
                <Text style={appleStyles.orText}>or sign up with email</Text>
                <View style={appleStyles.line} />
              </View>
            ) : null}

            {/* Fields */}
            <View style={[styles.fields, !appleAvailable && { marginTop: 24 }]}>
              <Field
                label="Email"
                placeholder="maya@hey.com"
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
                placeholder="at least 8 chars"
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

            {/* Weekly emails checkbox */}
            <Pressable style={[styles.checkRow, { marginTop: 12 }]} onPress={() => setWeeklyEmails(!weeklyEmails)}>
              <View style={[styles.checkBox, !weeklyEmails && { backgroundColor: colors.paperAlt }]}>
                {weeklyEmails ? <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>✓</Text> : null}
              </View>
              <Text style={styles.checkText}>Send me weekly progress emails</Text>
            </Pressable>

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
                label="Continue →"
                onPress={onSubmit}
                loading={submitting}
                disabled={!canSubmit}
                bg={colors.brand}
              />
            </View>

            <Text style={styles.termsText}>
              By signing up you agree to the{" "}
              <Text style={styles.termsLink}>terms</Text>.
            </Text>

            <Link href="/(auth)/login" asChild>
              <Pressable style={[styles.footerLink, { marginTop: 12 }]}>
                <Text style={styles.footer}>
                  Already have one?{" "}
                  <Text style={styles.footerAccent}>Sign in</Text>
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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

const localStyles = StyleSheet.create({
  scroll: { flexGrow: 1 },
});

const appleStyles = StyleSheet.create({
  buttonWrap: { marginTop: spacing.lg },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: 4,
  },
  line: { flex: 1, height: 1.5, backgroundColor: colors.ink4 },
  orText: { fontSize: 12, color: colors.ink3, flexShrink: 0, fontWeight: "600" },
  button: { height: 50, width: "100%" },
});
