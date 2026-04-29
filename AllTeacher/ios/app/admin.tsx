/**
 * Admin dashboard — single-operator view of business health.
 *
 * Visible only when useAdmin() returns true (i.e. logged-in email
 * matches ADMIN_EMAIL). The backend ALSO 404s these routes for anyone
 * else, so this screen is purely a UX hint — it can't be reached
 * meaningfully by other users.
 *
 * Sections (top → bottom):
 *   1. Headline KPIs — total users, paying, MRR, today + 30-day cost,
 *      30-day margin
 *   2. Activity — DAU/WAU/MAU + signups today/7d/30d
 *   3. Subscription mix — counts per tier
 *   4. API cost trend — daily cost line + per-agent breakdown table
 *   5. Engagement — daily active-users series + total sessions completed
 *   6. Profit — month-by-month revenue / cost / margin
 *   7. Top spenders — recent users sorted by 30-day token cost
 *
 * One ScrollView; data loads in parallel on focus and refreshes on pull
 * (RefreshControl). All amounts that mix currencies (USD cost vs. EUR
 * revenue) are labelled — the dashboard cares about the trend more
 * than the precise dollar figure, so this is acceptable for v1.
 */
import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import {
  api,
  ApiError,
  type AdminEngagement,
  type AdminOverview,
  type AdminProfit,
  type AdminUsage,
  type AdminUser,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  LoadingBlock,
  MessageBox,
  ScreenContainer,
  Toolbar,
} from "@/components/ui";
import { colors, radii, shadow, spacing, type } from "@/lib/theme";

// --- formatters --------------------------------------------------------

function fmtMoneyCents(cents: number, currency = "EUR"): string {
  const sym = currency === "USD" ? "$" : "€";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}${sym}${abs.toFixed(2)}`;
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString();
}

// --- mini line chart (no external dep — Recharts isn't bundled) --------

function MiniLine({
  series,
  height = 80,
  stroke,
}: {
  series: { date: string; value: number }[];
  height?: number;
  stroke: string;
}) {
  if (series.length === 0) {
    return <Text style={type.caption}>No data yet.</Text>;
  }
  const max = Math.max(1, ...series.map((p) => p.value));
  return (
    <View style={[styles.chartRow, { height }]}>
      {series.map((p, i) => {
        const h = (p.value / max) * 100;
        return (
          <View key={`${p.date}-${i}`} style={styles.chartCol}>
            <View
              style={[
                styles.chartBar,
                {
                  height: `${Math.max(2, h)}%`,
                  backgroundColor: stroke,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

// --- KPI tile ----------------------------------------------------------

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const valueColor =
    tone === "good"
      ? colors.success
      : tone === "bad"
      ? colors.danger
      : colors.text;
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

// --- screen ------------------------------------------------------------

export default function AdminScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [engagement, setEngagement] = useState<AdminEngagement | null>(null);
  const [profit, setProfit] = useState<AdminProfit | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Grant-tier modal state. `granting` blocks the row buttons while a
  // request is in flight; `grantTarget` (when set) opens the modal.
  const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    const token = session.access_token;
    setError(null);
    try {
      const [ov, us, en, pr, usr] = await Promise.all([
        api.adminOverview(token),
        api.adminUsage(token, 30),
        api.adminEngagement(token, 30),
        api.adminProfit(token, 6),
        api.adminUsers(token, 30),
      ]);
      setOverview(ov);
      setUsage(us);
      setEngagement(en);
      setProfit(pr);
      setUsers(usr.users);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const isLoading =
    !overview && !usage && !engagement && !profit && !users && !error;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: "Admin" }} />
      <Toolbar
        title="Admin dashboard"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        onHome={() => router.replace("/")}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {error ? <MessageBox variant="error" message={error} /> : null}

        {isLoading ? (
          <View style={styles.card}>
            <LoadingBlock light={false} />
          </View>
        ) : null}

        {/* 1. Headline KPIs ------------------------------------------- */}
        {overview ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionTitle}>Headline</Text>
            <View style={styles.kpiGrid}>
              <Kpi
                label="Users"
                value={fmtInt(overview.users.total)}
                hint={`+${overview.users.signups_30d} in 30d`}
              />
              <Kpi
                label="Paying"
                value={fmtInt(overview.subscriptions.paying)}
                hint={`of ${fmtInt(overview.users.total)} total`}
              />
              <Kpi
                label="Monthly revenue"
                value={fmtMoneyCents(
                  overview.subscriptions.mrr_cents,
                  overview.subscriptions.currency,
                )}
                hint="from active subscriptions"
                tone="good"
              />
              <Kpi
                label="API cost (30d)"
                value={fmtMoneyCents(
                  overview.cost.last_30d_cents,
                  overview.cost.currency,
                )}
                hint={`today: ${fmtMoneyCents(
                  overview.cost.today_cents,
                  overview.cost.currency,
                )}`}
                tone="bad"
              />
              <Kpi
                label="Profit (30d)"
                value={fmtMoneyCents(
                  overview.margin.last_30d_cents,
                  "EUR",
                )}
                hint="revenue − API cost"
                tone={
                  overview.margin.last_30d_cents >= 0 ? "good" : "bad"
                }
              />
            </View>
          </View>
        ) : null}

        {/* 2. Activity ---------------------------------------------- */}
        {overview ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionTitle}>Activity</Text>
            <View style={styles.kpiGrid}>
              <Kpi
                label="Active today"
                value={fmtInt(overview.users.dau)}
                hint="users who practiced"
              />
              <Kpi
                label="Active this week"
                value={fmtInt(overview.users.wau)}
                hint="last 7 days"
              />
              <Kpi
                label="Active this month"
                value={fmtInt(overview.users.mau)}
                hint="last 30 days"
              />
              <Kpi
                label="New signups today"
                value={fmtInt(overview.users.signups_today)}
                hint={`${fmtInt(overview.users.signups_7d)} this week`}
              />
            </View>
          </View>
        ) : null}

        {/* 3. Subscription mix ------------------------------------- */}
        {overview ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Subscription mix</Text>
            <View style={styles.tierRow}>
              <Kpi
                label="Free"
                value={fmtInt(overview.subscriptions.by_tier.free)}
              />
              <Kpi
                label="Pro"
                value={fmtInt(overview.subscriptions.by_tier.pro)}
                hint={fmtMoneyCents(overview.tier_prices.pro, "EUR") + "/mo"}
              />
              <Kpi
                label="Power"
                value={fmtInt(overview.subscriptions.by_tier.power)}
                hint={fmtMoneyCents(overview.tier_prices.power, "EUR") + "/mo"}
              />
            </View>
          </View>
        ) : null}

        {/* 4. API cost trend ----------------------------------------- */}
        {usage ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>API cost — last 30 days</Text>
            <Text style={styles.subtleHint}>
              Total {fmtMoneyCents(usage.total_cost_cents, usage.currency)}
            </Text>
            <MiniLine series={usage.series} stroke={colors.danger} />
            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
              By agent
            </Text>
            {usage.by_agent.length === 0 ? (
              <Text style={type.caption}>No agent activity yet.</Text>
            ) : (
              usage.by_agent.map((a) => (
                <View key={a.agent} style={styles.row}>
                  <Text style={styles.rowLabel}>{a.agent}</Text>
                  <Text style={styles.rowValue}>
                    {fmtMoneyCents(a.cost_cents, usage.currency)}
                  </Text>
                  <Text style={styles.rowHint}>{fmtInt(a.calls)} calls</Text>
                </View>
              ))
            )}
            {usage.by_model.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
                  By model
                </Text>
                {usage.by_model.map((m) => (
                  <View key={m.model} style={styles.row}>
                    <Text style={styles.rowLabel}>{m.model}</Text>
                    <Text style={styles.rowValue}>
                      {fmtMoneyCents(m.cost_cents, usage.currency)}
                    </Text>
                    <Text style={styles.rowHint}>
                      {fmtInt(m.calls)} calls
                    </Text>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        {/* 5. Engagement -------------------------------------------- */}
        {engagement ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Daily active users — last 30 days
            </Text>
            <Text style={styles.subtleHint}>
              {fmtInt(engagement.sessions_completed_total)} sessions completed
              all-time
            </Text>
            <MiniLine
              series={engagement.active_users_series}
              stroke={colors.brand}
            />
          </View>
        ) : null}

        {/* 6. Profit ------------------------------------------------- */}
        {profit && profit.months.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profit — last 6 months</Text>
            {profit.months.map((m) => (
              <View key={m.month} style={styles.row}>
                <Text style={styles.rowLabel}>{m.month}</Text>
                <Text style={styles.rowValue}>
                  {fmtMoneyCents(m.revenue_cents, "EUR")}
                </Text>
                <Text style={[styles.rowHint, { color: colors.danger }]}>
                  −{fmtMoneyCents(m.cost_cents, "USD")}
                </Text>
                <Text
                  style={[
                    styles.rowHint,
                    {
                      color:
                        m.margin_cents >= 0
                          ? colors.success
                          : colors.danger,
                      fontWeight: "700",
                    },
                  ]}
                >
                  = {fmtMoneyCents(m.margin_cents, "EUR")}
                </Text>
              </View>
            ))}
            <Text
              style={[
                type.caption,
                { marginTop: spacing.xs, color: colors.textFaint },
              ]}
            >
              Note: revenue in EUR, cost in USD — small FX drift.
            </Text>
          </View>
        ) : null}

        {/* 7. Top spenders + manual subscription grants -------------- */}
        {users && users.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Top users by 30-day API cost
            </Text>
            <Text style={styles.subtleHint}>
              Tap a user to promote them to Pro/Power. Grants land in the
              `subscriptions` table and apply on the user's next request.
            </Text>
            {users.slice(0, 24).map((u) => (
              <UserRow
                key={u.id ?? u.email ?? Math.random()}
                user={u}
                disabled={granting}
                onGrant={() => setGrantTarget(u)}
                onRevoke={async () => {
                  if (!session?.access_token || !u.id) return;
                  Alert.alert(
                    "Revoke subscription?",
                    `Drop ${u.email ?? "this user"} back to Free?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Revoke",
                        style: "destructive",
                        onPress: async () => {
                          setGranting(true);
                          try {
                            await api.adminRevokeTier(
                              session.access_token,
                              u.id!,
                            );
                            await load();
                          } catch (e) {
                            Alert.alert("Revoke failed", (e as Error).message);
                          } finally {
                            setGranting(false);
                          }
                        },
                      },
                    ],
                  );
                }}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <GrantTierModal
        target={grantTarget}
        busy={granting}
        onClose={() => setGrantTarget(null)}
        onSubmit={async (tier, days) => {
          if (!session?.access_token || !grantTarget?.id) return;
          setGranting(true);
          try {
            await api.adminGrantTier(session.access_token, {
              user_id: grantTarget.id,
              tier,
              days,
            });
            setGrantTarget(null);
            await load();
          } catch (e) {
            const msg =
              e instanceof ApiError
                ? e.body?.detail || e.body?.error || e.message
                : (e as Error).message;
            Alert.alert("Grant failed", String(msg));
          } finally {
            setGranting(false);
          }
        }}
      />
    </ScreenContainer>
  );
}

// --- supporting UI ----------------------------------------------------

/**
 * One row in the Top users list. Shows the email, the 30-day spend,
 * a tier badge, and Grant / Revoke action buttons. Revoke is hidden
 * for users who are already Free — there's nothing to revoke.
 */
function UserRow({
  user,
  disabled,
  onGrant,
  onRevoke,
}: {
  user: AdminUser;
  disabled: boolean;
  onGrant: () => void;
  onRevoke: () => void;
}) {
  const tier = (user.tier || "free").toLowerCase();
  const tone =
    tier === "power"
      ? styles.tierPillPower
      : tier === "pro"
      ? styles.tierPillPro
      : styles.tierPillFree;
  return (
    <View style={styles.userRow}>
      <View style={styles.userRowTop}>
        <Text
          style={styles.rowLabel}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {user.email ?? "(no email)"}
        </Text>
        <Text style={styles.rowValue}>
          {fmtMoneyCents(user.cost_cents_window, "USD")}
        </Text>
      </View>
      <View style={styles.userRowBottom}>
        <View style={[styles.tierPill, tone]}>
          <Text style={styles.tierPillText}>{tier.toUpperCase()}</Text>
        </View>
        <Text style={styles.rowHint} numberOfLines={1}>
          {user.status || "free"}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable
          style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
          onPress={onGrant}
          disabled={disabled}
        >
          <Text style={styles.actionBtnText}>Grant…</Text>
        </Pressable>
        {tier !== "free" ? (
          <Pressable
            style={[
              styles.actionBtn,
              styles.actionBtnGhost,
              disabled && styles.actionBtnDisabled,
            ]}
            onPress={onRevoke}
            disabled={disabled}
          >
            <Text style={styles.actionBtnGhostText}>Revoke</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Modal that picks a tier (Pro / Power) and a period (30 / 90 / 365
 * days), then calls back. We don't expose Free here — the dedicated
 * Revoke button is more direct for that case.
 */
function GrantTierModal({
  target,
  busy,
  onClose,
  onSubmit,
}: {
  target: AdminUser | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (tier: "pro" | "power", days: number) => Promise<void> | void;
}) {
  const [tier, setTier] = useState<"pro" | "power">("pro");
  const [days, setDays] = useState<30 | 90 | 365>(30);

  // Reset selections each time the modal opens for a new user, so a
  // previous "Power / 365" doesn't leak into the next grant.
  if (target === null && (tier !== "pro" || days !== 30)) {
    // Cheap reset on close — runs in render but state setters are
    // batched, so this is a one-shot transition.
    setTier("pro");
    setDays(30);
  }

  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalScrim}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Grant subscription</Text>
          <Text style={styles.modalSubtitle} numberOfLines={1}>
            {target?.email ?? "(no email)"}
          </Text>

          <Text style={styles.modalLabel}>Tier</Text>
          <View style={styles.segmented}>
            <SegOption
              label="Pro"
              active={tier === "pro"}
              onPress={() => setTier("pro")}
            />
            <SegOption
              label="Power"
              active={tier === "power"}
              onPress={() => setTier("power")}
            />
          </View>

          <Text style={styles.modalLabel}>Period</Text>
          <View style={styles.segmented}>
            <SegOption
              label="30 days"
              active={days === 30}
              onPress={() => setDays(30)}
            />
            <SegOption
              label="90 days"
              active={days === 90}
              onPress={() => setDays(90)}
            />
            <SegOption
              label="1 year"
              active={days === 365}
              onPress={() => setDays(365)}
            />
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.actionBtn, styles.actionBtnGhost]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.actionBtnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
              onPress={() => onSubmit(tier, days)}
              disabled={busy}
            >
              <Text style={styles.actionBtnText}>
                {busy ? "Granting…" : "Grant"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SegOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.segOption, active && styles.segOptionActive]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.segOptionText,
          active && styles.segOptionTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// --- styles -----------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  sectionTitle: {
    ...type.h3,
  },
  subtleHint: {
    ...type.caption,
    color: colors.textMuted,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  kpi: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 110,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 2,
    ...shadow.card,
  },
  kpiLabel: {
    ...type.label,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  kpiHint: {
    ...type.caption,
  },
  tierRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    minWidth: 60,
    textAlign: "right",
  },
  rowHint: {
    color: colors.textMuted,
    fontSize: 12,
    minWidth: 70,
    textAlign: "right",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    marginTop: spacing.sm,
  },
  chartCol: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  chartBar: {
    width: "100%",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  // --- per-user grant row ---------------------------------------------
  userRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 6,
  },
  userRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  userRowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tierPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  tierPillFree: {
    backgroundColor: colors.border,
  },
  tierPillPro: {
    backgroundColor: colors.brand,
  },
  tierPillPower: {
    backgroundColor: colors.brandDeep,
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: "#fff",
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  actionBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnGhostText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },

  // --- modal -----------------------------------------------------------
  modalScrim: {
    flex: 1,
    backgroundColor: "#00000099",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    ...type.h2,
  },
  modalSubtitle: {
    ...type.bodyMuted,
    marginBottom: spacing.sm,
  },
  modalLabel: {
    ...type.label,
    marginTop: spacing.sm,
  },
  segmented: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  segOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  segOptionActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  segOptionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  segOptionTextActive: {
    color: "#fff",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
