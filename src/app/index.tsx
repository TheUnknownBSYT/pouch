/**
 * Inbox screen — main capture surface
 * List + search + filters + bottom capture bar
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterBar, type InboxFilter } from '@/components/filter-bar';
import { PressableScale } from '@/components/pressable-scale';
import { RichContent } from '@/components/rich-content';
import { useAuth } from '@/contexts/AuthContext';
import {
  getItemIcon,
  getPriorityColor,
  getPriorityTint,
  getTypeColor,
  getTypeTint,
  radii,
  shadows,
  spacing,
  typography,
  useThemeColors,
} from '@/constants/ui';
import { formatDueDate, formatSignedAmount } from '@/lib/classifyItem';
import { callPhone, openWhatsApp } from '@/lib/contacts';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { openLink, extractFirstUrl } from '@/lib/urls';
import { useItems } from '@/hooks/useItems';
import type { Item } from '@/types/item';
import { ACCOUNT_LABELS, PRIORITY_LABELS } from '@/types/item';

function truncateContent(content: string, maxLength = 90): string {
  const singleLine = content.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength - 1)}…`;
}

function Badge({ label, color, tint }: { label: string; color: string; tint: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: tint }]}>
      <Text style={[styles.badgeText, typography.numeric, { color }]}>{label}</Text>
    </View>
  );
}

function ItemRow({
  item,
  onOpen,
  onToggleDone,
}: {
  item: Item;
  onOpen: () => void;
  onToggleDone: (item: Item) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = useThemeColors(isDark);
  const linkUrl = item.type === 'link' ? extractFirstUrl(item.content) : null;
  const typeColor = getTypeColor(item.type);

  return (
    <PressableScale
      scaleTo={0.985}
      onPress={onOpen}
      style={[
        styles.row,
        shadows.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderLeftColor: typeColor,
        },
      ]}>
      {item.type === 'task' ? (
        <PressableScale
          hitSlop={12}
          scaleTo={0.85}
          onPress={() => void onToggleDone(item)}
          style={styles.leadingAction}>
          <Ionicons
            color={item.done ? theme.success : theme.textFaint}
            name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
          />
        </PressableScale>
      ) : (
        <View style={[styles.iconWrap, { backgroundColor: getTypeTint(item.type, isDark) }]}>
          <Ionicons color={typeColor} name={getItemIcon(item.type)} size={20} />
        </View>
      )}

      <View style={styles.rowBody}>
        <RichContent
          content={truncateContent(item.content)}
          numberOfLines={2}
          muted={item.type === 'task' && item.done}
          style={typography.rowTitle}
        />

        <View style={styles.metaRow}>
          <Text style={[typography.rowMeta, typography.numeric, { color: theme.textFaint }]}>
            {formatRelativeTime(item.occurred_at ?? item.created_at)}
          </Text>
          {item.type === 'expense' && item.amount != null && item.direction ? (
            <Badge
              label={formatSignedAmount(item.amount, item.direction)}
              color={item.direction === 'in' ? theme.success : theme.text}
              tint={item.direction === 'in' ? `${theme.success}17` : theme.inputBackground}
            />
          ) : null}
          {item.type === 'expense' && item.account ? (
            <Badge
              label={ACCOUNT_LABELS[item.account]}
              color={theme.textMuted}
              tint={theme.inputBackground}
            />
          ) : null}
          {item.type === 'task' && item.priority && item.priority !== 'low' ? (
            <Badge
              label={PRIORITY_LABELS[item.priority]}
              color={getPriorityColor(item.priority)}
              tint={getPriorityTint(item.priority, isDark)}
            />
          ) : null}
          {item.type === 'task' && item.due_at ? (
            <Badge
              label={formatDueDate(item.due_at)}
              color={theme.accent}
              tint={theme.accentMuted}
            />
          ) : null}
        </View>
      </View>

      {linkUrl ? (
        <PressableScale
          hitSlop={8}
          onPress={() => void openLink(linkUrl)}
          style={[styles.actionButton, { backgroundColor: theme.inputBackground }]}>
          <Ionicons color={theme.accent} name="open-outline" size={19} />
        </PressableScale>
      ) : null}

      {item.type === 'contact' ? (
        <View style={styles.contactActions}>
          <PressableScale
            hitSlop={8}
            onPress={() => void callPhone(item.content)}
            style={[styles.actionButton, { backgroundColor: theme.inputBackground }]}>
            <Ionicons color={theme.accent} name="call-outline" size={19} />
          </PressableScale>
          <PressableScale
            hitSlop={8}
            onPress={() => void openWhatsApp(item.content)}
            style={[styles.actionButton, { backgroundColor: theme.inputBackground }]}>
            <Ionicons color="#25D366" name="logo-whatsapp" size={19} />
          </PressableScale>
        </View>
      ) : null}
    </PressableScale>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');
  const { user, signOut } = useAuth();
  const { items, loading, refreshing, error, addItem, pullToRefresh, toggleTaskDone } = useItems();

  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const next: Record<InboxFilter, number> = {
      all: items.length,
      link: 0,
      task: 0,
      expense: 0,
      note: 0,
      unsorted: 0,
      contact: 0,
      quote: 0,
    };

    for (const item of items) {
      next[item.type] += 1;
    }

    return next;
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      if (filter !== 'all' && item.type !== filter) {
        return false;
      }

      if (query && !item.content.toLowerCase().includes(query)) {
        return false;
      }

      return true;
    });
  }, [filter, items, search]);

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || saving) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await addItem(trimmed);
      setDraft('');
      // One haptic, tied to the causal moment (the item landing), not a
      // decoration on every keystroke.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }, [addItem, draft, saving]);

  const handleToggleDone = useCallback(
    async (item: Item) => {
      try {
        await toggleTaskDone(item);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to update task');
      }
    },
    [toggleTaskDone],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        contentContainerStyle={[
          styles.listContent,
          filteredItems.length === 0 ? styles.listEmpty : null,
        ]}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void pullToRefresh()}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.accent} size="large" style={styles.emptyLoader} />
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.accentMuted }]}>
                <Ionicons
                  color={theme.accent}
                  name={search || filter !== 'all' ? 'search-outline' : 'sparkles-outline'}
                  size={24}
                />
              </View>
              <Text style={[typography.title, { color: theme.text }]}>
                {search || filter !== 'all' ? 'Nothing matches' : 'Inbox zero'}
              </Text>
              <Text style={[typography.body, { color: theme.textMuted, textAlign: 'center' }]}>
                {search || filter !== 'all'
                  ? 'Try another filter or search.'
                  : 'Dump a link, task, expense, contact, or quote below.'}
              </Text>
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={[typography.display, { color: theme.text }]}>Pouch</Text>
              {user?.email ? (
                <Text style={[typography.bodySmall, { color: theme.textFaint }]}>
                  {user.email}
                </Text>
              ) : null}
            </View>
            <View style={[styles.searchWrap, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="search" size={17} color={theme.textFaint} style={styles.searchIcon} />
              <TextInput
                clearButtonMode="while-editing"
                placeholder="Search…"
                placeholderTextColor={theme.textFaint}
                style={[styles.searchInput, { color: theme.text }]}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <FilterBar active={filter} counts={counts} onChange={setFilter} />
            {error || saveError ? (
              <Text style={[typography.bodySmall, styles.bannerError, { color: theme.danger }]}>
                {saveError ?? error}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            onOpen={() => router.push(`/item/${item.id}`)}
            onToggleDone={handleToggleDone}
          />
        )}
      />

      <View
        style={[
          styles.composer,
          shadows.raised,
          {
            backgroundColor: theme.surface,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}>
        <TextInput
          multiline
          placeholder="Capture anything…"
          placeholderTextColor={theme.textFaint}
          style={[
            styles.composerInput,
            { backgroundColor: theme.inputBackground, color: theme.text },
          ]}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          returnKeyType="send"
        />
        <PressableScale
          disabled={!draft.trim() || saving}
          onPress={handleSend}
          style={[
            styles.sendButton,
            {
              backgroundColor: theme.accent,
              opacity: !draft.trim() || saving ? 0.4 : 1,
            },
          ]}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons color="#FFFFFF" name="arrow-up" size={22} />
          )}
        </PressableScale>
      </View>

      <View style={styles.footerLinks}>
        <PressableScale onPress={() => router.push('/accounts')} scaleTo={0.95}>
          <Text style={[styles.footerLink, { color: theme.accent }]}>Accounts</Text>
        </PressableScale>
        <PressableScale onPress={signOut} scaleTo={0.95}>
          <Text style={[styles.footerLink, { color: theme.textFaint }]}>Sign out</Text>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 140,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    gap: spacing.md + 2,
    marginBottom: spacing.xs,
  },
  searchWrap: {
    alignItems: 'center',
    borderRadius: radii.lg,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: spacing.md,
  },
  emptyLoader: {
    marginTop: 48,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: radii.full,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    width: 56,
  },
  bannerError: {
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    borderRadius: radii.xl,
    borderLeftWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  leadingAction: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  rowBody: {
    flex: 1,
    gap: spacing.sm,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  badge: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  contactActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  composer: {
    alignItems: 'flex-end',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md + 2,
  },
  composerInput: {
    borderRadius: radii.xl,
    flex: 1,
    fontSize: 17,
    maxHeight: 140,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: radii.full,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  footerLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xl,
    justifyContent: 'center',
    paddingBottom: spacing.sm + 2,
    paddingTop: spacing.xs + 2,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
