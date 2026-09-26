import { useColorScheme, useSettings } from '@/contexts/SettingsContext';
/**
 * Inbox screen — main capture surface
 * List + search + filters + bottom capture bar
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PouchBrand } from '@/components/brand';
import { FilterBar, type InboxFilter } from '@/components/filter-bar';
import { PressableScale } from '@/components/pressable-scale';
import { RichContent } from '@/components/rich-content';
import {
  getItemIcon,
  getPriorityColor,
  getPriorityTint,
  radii,
  spacing,
  typography,
  useThemeColors,
} from '@/constants/ui';
import { classifyItem, itemTypeLabel, formatDueDate, formatSignedAmount } from '@/lib/classifyItem';
import { callPhone, openWhatsApp } from '@/lib/contacts';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { openLink, extractFirstUrl } from '@/lib/urls';
import { selectInboxItems, type TaskView } from '@/lib/inbox';
import { useItems } from '@/hooks/useItems';
import type { Item } from '@/types/item';
import { ACCOUNT_LABELS, PRIORITY_LABELS } from '@/types/item';

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

  return (
    <PressableScale
      scaleTo={0.985}
      onPress={onOpen}
      style={[
        styles.row,
        {
          backgroundColor: theme.background,
          borderColor: theme.border,
        },
      ]}>
      {item.type === 'task' ? (
        <PressableScale
          hitSlop={12}
          scaleTo={0.85}
          accessibilityRole="checkbox"
          accessibilityLabel={item.content}
          accessibilityState={{ checked: item.done }}
          onPress={(event) => { event.stopPropagation(); void onToggleDone(item); }}
          style={styles.leadingAction}>
          <Ionicons
            color={item.done ? theme.success : theme.textFaint}
            name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
          />
        </PressableScale>
      ) : (
        <View style={styles.iconWrap}>
          <Ionicons color={theme.textMuted} name={getItemIcon(item.type)} size={19} />
        </View>
      )}

      <View style={styles.rowBody}>
        <RichContent
          content={item.content}
          numberOfLines={2}
          muted={item.type === 'task' && item.done}
          style={typography.rowTitle}
        />

        <View style={styles.metaRow}>
          <Text style={[typography.rowMeta, typography.numeric, { color: theme.textFaint }]}>
            {itemTypeLabel(item.type)} · {formatRelativeTime(item.occurred_at ?? item.created_at)}
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
          accessibilityLabel="Open link"
          onPress={(event) => { event.stopPropagation(); void openLink(linkUrl); }}
          style={[styles.actionButton, { backgroundColor: theme.inputBackground }]}>
          <Ionicons color={theme.accent} name="open-outline" size={19} />
        </PressableScale>
      ) : null}

      {item.type === 'contact' ? (
        <View style={styles.contactActions}>
          <PressableScale
            hitSlop={8}
            accessibilityLabel="Call contact"
            onPress={(event) => { event.stopPropagation(); void callPhone(item.content); }}
            style={[styles.actionButton, { backgroundColor: theme.inputBackground }]}>
            <Ionicons color={theme.accent} name="call-outline" size={19} />
          </PressableScale>
          <PressableScale
            hitSlop={8}
            accessibilityLabel="Open WhatsApp"
            onPress={(event) => { event.stopPropagation(); void openWhatsApp(item.content); }}
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
  const { settings, updateSettings } = useSettings();
  const sort = settings.sort;
  const setSort = (value: typeof sort) => updateSettings({ sort: value });
  const { items, loading, refreshing, error, addItem, pullToRefresh, toggleTaskDone } = useItems();

  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [taskView, setTaskView] = useState<TaskView>('all');
  const sendLock = useRef(false);
  const preview = useMemo(() => draft.trim() ? classifyItem(draft) : null, [draft]);
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

  const filteredItems = useMemo(
    () => selectInboxItems(items, filter, search, taskView, sort),
    [items, filter, search, taskView, sort],
  );

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || sendLock.current) {
      return;
    }

    sendLock.current = true;
    setSaving(true);
    setSaveError(null);

    try {
      await addItem(trimmed);
      setDraft((current) => current === draft ? '' : current);
      // One haptic, tied to the causal moment (the item landing), not a
      // decoration on every keystroke.
      if (settings.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      sendLock.current = false;
      setSaving(false);
    }
  }, [addItem, draft, settings.haptics]);

  const handleToggleDone = useCallback(
    async (item: Item) => {
      try {
        await toggleTaskDone(item);
        if (settings.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to update task');
      }
    },
    [toggleTaskDone, settings.haptics],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <FlatList
        keyboardShouldPersistTaps="handled"
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
                  name={search || filter !== 'all' ? 'search-outline' : 'file-tray-outline'}
                  size={24}
                />
              </View>
              <Text style={[typography.title, { color: theme.text }]}>
                {search || filter !== 'all' ? 'Nothing matches' : 'A little room for everything.'}
              </Text>
              <Text style={[typography.body, { color: theme.textMuted, textAlign: 'center' }]}>
                {search || filter !== 'all'
                  ? 'Try another filter or search.'
                  : 'A thought, a link, something to do. Drop your first capture below.'}
              </Text>
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.brandHeader}>
              <PouchBrand />
              <Text style={[typography.bodySmall, { color: theme.textMuted }]}>A little less to keep in your head.</Text>
            </View>
            <View style={[styles.searchWrap, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="search" size={17} color={theme.textFaint} style={styles.searchIcon} />
              <TextInput
                clearButtonMode="while-editing"
                accessibilityLabel="Search captures"
                placeholder="Search your pouch"
                placeholderTextColor={theme.textFaint}
                style={[styles.searchInput, { color: theme.text }]}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <FilterBar active={filter} counts={counts} onChange={setFilter} />
            {filter === 'task' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
                {(['all', 'open', 'today', 'overdue', 'done'] as TaskView[]).map((view) => (
                  <PressableScale key={view} accessibilityRole="button" accessibilityState={{ selected: taskView === view }} onPress={() => setTaskView(view)}>
                    <Text style={{ color: taskView === view ? theme.accent : theme.textMuted, fontWeight: '600', paddingVertical: 8 }}>
                      {view === 'all' ? 'All tasks' : view.charAt(0).toUpperCase() + view.slice(1)}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[typography.bodySmall, { color: theme.textMuted }]}>YOUR INBOX · {filteredItems.length}</Text>
              <PressableScale accessibilityRole="button" accessibilityLabel="Change sort order" onPress={() => setSort(sort === 'newest' ? 'oldest' : sort === 'oldest' ? 'priority' : 'newest')}>
                <Text style={{ color: theme.accent, paddingVertical: 8 }}>{sort === 'newest' ? 'Newest first' : sort === 'oldest' ? 'Oldest first' : 'Priority & due date'} ↕</Text>
              </PressableScale>
            </View>
            {error ? <PressableScale onPress={() => void pullToRefresh()} accessibilityRole="button"><Text style={{ color: theme.accent }}>Retry loading</Text></PressableScale> : null}
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
          {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            paddingBottom: spacing.md,
          },
        ]}>
        <View style={{ flex: 1, gap: spacing.xs }}>
        {preview ? <Text accessibilityLiveRegion="polite" style={[typography.bodySmall, { color: theme.textMuted }]}>
          {itemTypeLabel(preview.type)}{preview.amount != null ? ` · ₹${preview.amount}` : ''}{preview.due_at ? ` · ${formatDueDate(preview.due_at)}` : ''}
        </Text> : null}
        <TextInput
          accessibilityLabel="Capture anything"
          multiline
          placeholder="Drop something here…"
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
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={saving ? 'Saving capture' : 'Save capture'}
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
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Ionicons color={theme.onAccent} name="arrow-up" size={22} />
          )}
        </PressableScale>
      </View>

      <View style={styles.footerLinks}>
        <Text style={[styles.footerLink, { color: theme.text }]}>Inbox</Text>
        <PressableScale onPress={() => router.push('/accounts')} scaleTo={0.95}>
          <Text style={[styles.footerLink, { color: theme.accent }]}>Accounts</Text>
        </PressableScale>
        <PressableScale accessibilityRole="button" onPress={() => router.push('./settings')} scaleTo={0.95}>
          <Text style={[styles.footerLink, { color: theme.textMuted }]}>Settings</Text>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  listEmpty: {
    flexGrow: 1,
  },
  brandHeader: { gap: spacing.sm, marginBottom: spacing.md },
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
    paddingTop: 64,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: 0,
  },
  leadingAction: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  contactActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  composer: {
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  composerInput: {
    borderRadius: radii.xl,
    fontSize: 17,
    maxHeight: 140,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: radii.lg,
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
    minHeight: 44,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '700',
  },
});
