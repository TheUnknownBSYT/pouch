import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { useItems } from '@/contexts/ItemsContext';
import { radii, shadows, spacing, typography, useThemeColors } from '@/constants/ui';
import {
  buildMonthlyCsv,
  buildMonthlyExportRows,
  computeAccountBalances,
  filterExpensesForMonth,
  monthLabel,
} from '@/lib/accounts';
import { formatAmount, formatSignedAmount } from '@/lib/classifyItem';
import { downloadCsv, exportFilename } from '@/lib/export';
import type { AccountSlug } from '@/types/item';
import { ACCOUNT_LABELS } from '@/types/item';

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export default function AccountsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');
  const { items, loading } = useItems();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const balances = useMemo(() => computeAccountBalances(items), [items]);
  const monthItems = useMemo(() => filterExpensesForMonth(items, year, month), [items, month, year]);

  const monthTotals = useMemo(() => {
    const totals = {
      cash: { in: 0, out: 0 },
      gpay: { in: 0, out: 0 },
    };

    for (const item of monthItems) {
      if (!item.account || item.amount == null || !item.direction) {
        continue;
      }
      if (item.direction === 'in') {
        totals[item.account].in += item.amount;
      } else {
        totals[item.account].out += item.amount;
      }
    }

    return totals;
  }, [monthItems]);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);

    try {
      const csv = buildMonthlyCsv(items, year, month);
      await downloadCsv(exportFilename(year, month), csv);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Accounts' }} />
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, { color: theme.text }]}>Balances</Text>
        <View style={styles.balanceGrid}>
          {balances.map((account) => (
            <View key={account.slug} style={[styles.balanceCard, shadows.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>{account.label}</Text>
              <Text style={[styles.balanceValue, typography.numeric, { color: theme.text }]}>
                {account.balance >= 0 ? '+' : '-'}
                {formatAmount(Math.abs(account.balance))}
              </Text>
              <Text style={[styles.balanceMeta, typography.numeric, { color: theme.textFaint }]}>
                In {formatAmount(account.income)} · Out {formatAmount(account.expense)}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.monthCard, shadows.card, { backgroundColor: theme.surface }]}>
          <View style={styles.monthHeader}>
            <PressableScale
              scaleTo={0.9}
              onPress={() => {
                const prev = shiftMonth(year, month, -1);
                setYear(prev.year);
                setMonth(prev.month);
              }}
              style={[styles.monthButton, { backgroundColor: theme.inputBackground }]}>
              <Ionicons color={theme.text} name="chevron-back" size={18} />
            </PressableScale>
            <Text style={[styles.monthTitle, { color: theme.text }]}>{monthLabel(year, month)}</Text>
            <PressableScale
              scaleTo={0.9}
              onPress={() => {
                const next = shiftMonth(year, month, 1);
                setYear(next.year);
                setMonth(next.month);
              }}
              style={[styles.monthButton, { backgroundColor: theme.inputBackground }]}>
              <Ionicons color={theme.text} name="chevron-forward" size={18} />
            </PressableScale>
          </View>

          <View style={styles.monthSummaryRow}>
            {(['cash', 'gpay'] as AccountSlug[]).map((slug) => (
              <View key={slug} style={styles.monthSummaryItem}>
                <Text style={[styles.monthSummaryLabel, { color: theme.textMuted }]}>
                  {ACCOUNT_LABELS[slug]}
                </Text>
                <Text style={[styles.monthSummaryValue, typography.numeric, { color: theme.text }]}>
                  +{formatAmount(monthTotals[slug].in)} / -{formatAmount(monthTotals[slug].out)}
                </Text>
              </View>
            ))}
          </View>

          <PressableScale
            disabled={exporting || monthItems.length === 0}
            onPress={() => void handleExport()}
            style={[
              styles.exportButton,
              {
                backgroundColor: theme.accent,
                opacity: exporting || monthItems.length === 0 ? 0.4 : 1,
              },
            ]}>
            {exporting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons color="#FFFFFF" name="download-outline" size={17} />
                <Text style={styles.exportButtonText}>Export CSV</Text>
              </>
            )}
          </PressableScale>
          {exportError ? <Text style={[styles.error, { color: theme.danger }]}>{exportError}</Text> : null}
        </View>

        <Text style={[styles.heading, { color: theme.text }]}>Transactions</Text>
        {loading ? (
          <ActivityIndicator color={theme.accent} />
        ) : monthItems.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>No transactions this month.</Text>
        ) : (
          <View style={[styles.table, shadows.card, { backgroundColor: theme.surface }]}>
            <View style={[styles.tableHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.cellDate, styles.headerText, { color: theme.textFaint }]}>Date</Text>
              <Text style={[styles.cellAccount, styles.headerText, { color: theme.textFaint }]}>Acct</Text>
              <Text style={[styles.cellDescription, styles.headerText, { color: theme.textFaint }]}>
                Description
              </Text>
              <Text style={[styles.cellAmount, styles.headerText, { color: theme.textFaint }]}>Amt</Text>
            </View>
            {(['cash', 'gpay'] as AccountSlug[]).flatMap((account) =>
              buildMonthlyExportRows(monthItems, account).map((row) => (
                <View
                  key={`${row.date}-${row.description}-${row.signedAmount}`}
                  style={[styles.tableRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.cellDate, typography.numeric, { color: theme.text }]}>
                    {row.date.slice(5)}
                  </Text>
                  <Text style={[styles.cellAccount, { color: theme.textMuted }]}>{row.account}</Text>
                  <Text numberOfLines={1} style={[styles.cellDescription, { color: theme.text }]}>
                    {row.description}
                  </Text>
                  <Text
                    style={[
                      styles.cellAmount,
                      typography.numeric,
                      { color: row.direction === 'in' ? theme.success : theme.danger },
                    ]}>
                    {formatSignedAmount(row.amount, row.direction)}
                  </Text>
                </View>
              )),
            )}
          </View>
        )}

        <PressableScale onPress={() => router.back()} scaleTo={0.96} style={styles.backLink}>
          <Text style={[styles.backLinkText, { color: theme.accent }]}>Back to inbox</Text>
        </PressableScale>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heading: {
    ...typography.title,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  balanceCard: {
    borderRadius: radii.lg,
    flex: 1,
    gap: spacing.xs + 2,
    padding: spacing.md + 2,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  balanceMeta: {
    fontSize: 12,
  },
  monthCard: {
    borderRadius: radii.lg,
    gap: spacing.md + 2,
    padding: spacing.md + 2,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthButton: {
    alignItems: 'center',
    borderRadius: radii.full,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  monthSummaryRow: {
    gap: spacing.sm + 2,
  },
  monthSummaryItem: {
    gap: spacing.xs,
  },
  monthSummaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  monthSummaryValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  exportButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
  table: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  tableHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  tableRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cellDate: {
    fontSize: 12,
    width: 42,
  },
  cellAccount: {
    fontSize: 12,
    width: 42,
  },
  cellDescription: {
    flex: 1,
    fontSize: 13,
  },
  cellAmount: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    width: 56,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  backLinkText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
