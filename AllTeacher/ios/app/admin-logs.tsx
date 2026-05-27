/**
 * Admin — Request logs viewer.
 *
 * Sections (top → bottom):
 *   1. Slowest endpoints chart — horizontal bars (avg ms per route).
 *      Method badge + path label + avg bar + avg/max/count/error labels.
 *   2. Paginated request log table — 50 rows per page, Previous / Next
 *      navigation. Each row: timestamp, method badge, path, status (green
 *      2xx / red 4xx-5xx), duration ms, user email, error text when set.
 *
 * All data loaded in parallel on mount and on pull-to-refresh.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";

import {
  api,
  type EndpointStat,
  type RequestLog,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MessageBox, ScreenContainer, Toolbar } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

const PAGE = 50;

// ── helpers ───────────────────────────────────────────────────────────────

function fmtTs(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date} ${time}`;
}

function methodColor(m: string): { bg: string; fg: string } {
  switch ((m || "").toUpperCase()) {
    case "GET":    return { bg: "#d1fae5", fg: "#065f46" };
    case "POST":   return { bg: "#dbeafe", fg: "#1e40af" };
    case "DELETE": return { bg: "#fee2e2", fg: "#991b1b" };
    case "PATCH":  return { bg: "#fef3c7", fg: "#92400e" };
    default:       return { bg: "#f3f4f6", fg: colors.ink2 };
  }
}

// ── sub-components ────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const { bg, fg } = methodColor(method);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>
        {(method || "?").toUpperCase()}
      </Text>
    </View>
  );
}

function StatusBadge({ code }: { code: number | null }) {
  if (code == null) return null;
  const ok = code >= 200 && code < 300;
  return (
    <View style={[styles.badge, { backgroundColor: ok ? "#d1fae5" : "#fee2e2", minWidth: 36 }]}>
      <Text style={[styles.badgeText, { color: ok ? "#065f46" : "#991b1b" }]}>
        {code}
      </Text>
    </View>
  );
}

// ── Slowest endpoints chart ───────────────────────────────────────────────

function SlownessChart({ stats }: { stats: EndpointStat[] }) {
  if (stats.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Slowest endpoints</Text>
        <Text style={styles.emptyHint}>No data yet.</Text>
      </View>
    );
  }

  const maxAvg = Math.max(1, ...stats.map((s) => s.avg_ms));

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Slowest endpoints (avg response time)</Text>
      <View style={{ gap: 8 }}>
        {stats.map((s, i) => {
          const barPct = Math.max(3, (s.avg_ms / maxAvg) * 100);
          const { bg: mBg, fg: mFg } = methodColor(s.method);
          const hasErrors = s.error_count > 0;
          return (
            <View key={i} style={styles.chartRow}>
              {/* route label row */}
              <View style={styles.chartLabelRow}>
                <View style={[styles.badge, { backgroundColor: mBg }]}>
                  <Text style={[styles.badgeText, { color: mFg }]}>
                    {s.method.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.chartPath} numberOfLines={1} ellipsizeMode="tail">
                  {s.path}
                </Text>
              </View>
              {/* bar */}
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${barPct}%` as `${number}%`,
                      backgroundColor: s.avg_ms > 3000
                        ? colors.warn
                        : s.avg_ms > 1000
                        ? "#f59e0b"
                        : colors.ok,
                    },
                  ]}
                />
              </View>
              {/* stats row */}
              <View style={styles.chartStatRow}>
                <Text style={styles.chartStat}>avg {s.avg_ms} ms</Text>
                <Text style={styles.chartStat}>max {s.max_ms} ms</Text>
                <Text style={styles.chartStat}>{s.count} calls</Text>
                {hasErrors ? (
                  <Text style={[styles.chartStat, { color: colors.warn, fontWeight: "700" }]}>
                    {s.error_count} err
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────

function LogRow({ row }: { row: RequestLog }) {
  return (
    <View style={styles.logRow}>
      {/* top: timestamp + duration */}
      <View style={styles.rowTop}>
        <Text style={styles.ts}>{fmtTs(row.created_at)}</Text>
        {row.duration_ms != null ? (
          <Text
            style={[
              styles.duration,
              row.duration_ms > 3000
                ? { color: colors.warn, fontWeight: "700" }
                : row.duration_ms > 1000
                ? { color: "#b45309" }
                : null,
            ]}
          >
            {row.duration_ms} ms
          </Text>
        ) : null}
      </View>

      {/* middle: method + path + status */}
      <View style={styles.rowMid}>
        <MethodBadge method={row.method} />
        <Text style={styles.path} numberOfLines={1} ellipsizeMode="tail">
          {row.path}
        </Text>
        <StatusBadge code={row.status_code} />
      </View>

      {/* email — only when present */}
      {row.user_email ? (
        <Text style={styles.email} numberOfLines={1}>
          {row.user_email}
        </Text>
      ) : null}

      {/* error — only when present */}
      {row.error ? (
        <Text style={styles.errorText} numberOfLines={2}>
          {row.error}
        </Text>
      ) : null}
    </View>
  );
}

// ── Pagination bar ────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
  disabled,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.pagBar}>
      <Pressable
        style={[styles.pagBtn, (page === 0 || disabled) && styles.pagBtnDisabled]}
        onPress={onPrev}
        disabled={page === 0 || disabled}
      >
        <Text style={styles.pagBtnText}>← Prev</Text>
      </Pressable>
      <Text style={styles.pagInfo}>
        Page {page + 1} / {Math.max(1, totalPages)}
      </Text>
      <Pressable
        style={[styles.pagBtn, (page >= totalPages - 1 || disabled) && styles.pagBtnDisabled]}
        onPress={onNext}
        disabled={page >= totalPages - 1 || disabled}
      >
        <Text style={styles.pagBtnText}>Next →</Text>
      </Pressable>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function AdminLogsScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const [stats, setStats] = useState<EndpointStat[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PAGE);

  const loadLogs = useCallback(
    async (p: number) => {
      if (!session?.access_token) return;
      try {
        const res = await api.adminLogs(session.access_token, {
          limit: PAGE,
          offset: p * PAGE,
        });
        setTotal(res.total);
        setLogs(res.logs);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [session?.access_token],
  );

  const loadStats = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await api.adminLogStats(session.access_token);
      setStats(res.stats);
    } catch {
      // non-fatal
    }
  }, [session?.access_token]);

  const loadAll = useCallback(
    async (p = 0) => {
      if (!session?.access_token) return;
      setError(null);
      setLoading(true);
      await Promise.all([loadLogs(p), loadStats()]);
      setLoading(false);
    },
    [loadLogs, loadStats, session?.access_token],
  );

  // Load on mount.
  useEffect(() => {
    loadAll(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(0);
    await loadAll(0);
    setRefreshing(false);
  }, [loadAll]);

  const goToPage = useCallback(
    async (p: number) => {
      setPage(p);
      setLoading(true);
      await loadLogs(p);
      setLoading(false);
    },
    [loadLogs],
  );

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: "Request Logs" }} />
      <Toolbar
        title="Request logs"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/admin"))}
        onHome={() => router.replace("/")}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── Slowest endpoints chart ─────────────────────────────────── */}
        <SlownessChart stats={stats} />

        {/* ── Log list header ──────────────────────────────────────────── */}
        <View>
          <Text style={styles.listTitle}>
            {total > 0
              ? `${total.toLocaleString()} requests total`
              : "No requests logged yet"}
          </Text>
          <Text style={styles.listSub}>Pull to refresh · 50 per page</Text>
        </View>

        {error ? <MessageBox variant="error" message={error} /> : null}

        {/* ── Pagination (top) ─────────────────────────────────────────── */}
        {total > PAGE ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPrev={() => goToPage(page - 1)}
            onNext={() => goToPage(page + 1)}
            disabled={loading}
          />
        ) : null}

        {/* ── Rows ──────────────────────────────────────────────────────── */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.ink}
            style={{ marginVertical: spacing.xl }}
          />
        ) : (
          logs.map((row) => <LogRow key={row.id} row={row} />)
        )}

        {/* ── Pagination (bottom) ──────────────────────────────────────── */}
        {total > PAGE ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPrev={() => goToPage(page - 1)}
            onNext={() => goToPage(page + 1)}
            disabled={loading}
          />
        ) : null}

        {logs.length > 0 && total <= PAGE ? (
          <Text style={styles.endHint}>— end —</Text>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const INK_SHADOW = {
  shadowColor: colors.ink,
  shadowOpacity: 1 as const,
  shadowRadius: 0,
  shadowOffset: { width: 2, height: 2 },
  elevation: 2,
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },

  // ── chart ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.md,
    gap: spacing.sm,
    ...INK_SHADOW,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.ink,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  emptyHint: {
    fontSize: 12,
    color: colors.ink3,
  },
  chartRow: {
    gap: 3,
  },
  chartLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chartPath: {
    flex: 1,
    fontSize: 12,
    color: colors.ink,
    fontFamily: "monospace",
  },
  barTrack: {
    height: 10,
    backgroundColor: colors.ink5 ?? "#f3f4f6",
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  chartStatRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chartStat: {
    fontSize: 11,
    color: colors.ink3,
  },

  // ── list header ────────────────────────────────────────────────────────
  listTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.ink,
  },
  listSub: {
    fontSize: 12,
    color: colors.ink3,
    marginTop: 2,
  },

  // ── log row ────────────────────────────────────────────────────────────
  logRow: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.sm,
    gap: 3,
    ...INK_SHADOW,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowMid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ts: {
    fontSize: 11,
    color: colors.ink3,
    fontFamily: "monospace",
  },
  duration: {
    fontSize: 11,
    color: colors.ink3,
    fontFamily: "monospace",
  },
  path: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    fontFamily: "monospace",
  },
  email: {
    fontSize: 11,
    color: colors.ink3,
    paddingLeft: 2,
  },
  errorText: {
    fontSize: 12,
    color: colors.warn,
    lineHeight: 16,
  },

  // ── badges ────────────────────────────────────────────────────────────
  badge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  // ── pagination ────────────────────────────────────────────────────────
  pagBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  pagBtn: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.card,
    ...INK_SHADOW,
  },
  pagBtnDisabled: {
    opacity: 0.35,
  },
  pagBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  pagInfo: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink2,
  },

  endHint: {
    textAlign: "center",
    fontSize: 12,
    color: colors.ink4,
    marginTop: spacing.sm,
  },
});
