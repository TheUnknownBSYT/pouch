/**
 * Inbox screen — main capture surface
 * List + search + filters + bottom capture bar
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { PouchBrand } from '@/components/brand';
import { FilterBar, type InboxFilter } from '@/components/filter-bar';
import { TypePicker } from '@/components/type-picker';
import { PressableScale } from '@/components/pressable-scale';
import { RichContent } from '@/components/rich-content';
import { useAuth } from '@/contexts/AuthContext';
import { useSpace } from '@/contexts/SpaceContext';
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
import { formatDueDate, formatSignedAmount, itemTypeLabel } from '@/lib/classifyItem';
import { classifyCapture, MAX_CAPTURE_LENGTH } from '@/lib/capture';
import { useCaptureDraft } from '@/hooks/useCaptureDraft';
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
  pending,
}: {
  item: Item;
  onOpen: () => void;
  onToggleDone: (item: Item) => void;
  pending: boolean;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = useThemeColors(isDark);
  const linkUrl = item.type === 'link' ? extractFirstUrl(item.content) : null;
  const typeColor = getTypeColor(item.type);
  const { space } = useSpace();

  return (
    <PressableScale
      scaleTo={0.985}
      onPress={onOpen}
      style={[
        styles.row,
        shadows.card,
        {
          backgroundColor: theme.background,
          borderColor: theme.border,

          paddingVertical: space?.premium && space.compact ? spacing.sm : spacing.lg,
        },
      ]}>
      {item.type === 'task' ? (
        <PressableScale
          accessibilityRole="checkbox"
          accessibilityLabel={`Complete ${item.content}`}
          accessibilityState={{ checked: item.done, disabled: pending }}
          disabled={pending}
          hitSlop={12}
          scaleTo={0.85}
          onPress={(event) => { event.stopPropagation(); void onToggleDone(item); }}
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
          <Text style={[typography.rowMeta, { color: pending ? theme.accent : typeColor }]}>
            {pending ? 'Waiting to sync' : itemTypeLabel(item.type)}
          </Text>
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
          accessibilityRole="button"
          accessibilityLabel="Open saved link"
          onPress={(event) => { event.stopPropagation(); void openLink(linkUrl); }}
          style={[styles.actionButton, { backgroundColor: theme.inputBackground }]}>
          <Ionicons color={theme.accent} name="open-outline" size={19} />
        </PressableScale>
      ) : null}

      {item.type === 'contact' ? (
        <View style={styles.contactActions}>
          <PressableScale
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Call saved contact"
            onPress={(event) => { event.stopPropagation(); void callPhone(item.content); }}
            style={[styles.actionButton, { backgroundColor: theme.inputBackground }]}>
            <Ionicons color={theme.accent} name="call-outline" size={19} />
          </PressableScale>
          <PressableScale
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Message saved contact on WhatsApp"
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
  const { user } = useAuth();
  const { items, pendingIds, loading, refreshing, error, addItem, pullToRefresh, toggleTaskDone } = useItems();

  const { draft: captureDraft, update: updateDraft, ready: draftReady, error: draftError } = useCaptureDraft(user?.id);
  const draft = captureDraft.text;
  const setDraft = (text: string) => updateDraft({ ...captureDraft, text });
  const [showTypes, setShowTypes] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [saved, setSaved] = useState<Item | null>(null);
  const sending = useRef(false);
  const input = useRef<TextInput>(null);
  const classification = useMemo(() => classifyCapture(draft, captureDraft.type), [captureDraft.type, draft]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const completedCount = items.filter((item) => item.type === 'task' && item.done).length;
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 5000);
    return () => clearTimeout(timer);
  }, [saved]);

  const counts = useMemo(() => {
    const next: Record<InboxFilter, number> = {
      all: 0,
      link: 0,
      task: 0,
      expense: 0,
      note: 0,
      unsorted: 0,
      contact: 0,
      quote: 0,
    };

    for (const item of items) {
      if (!showCompleted && item.type === 'task' && item.done) continue;
      next.all += 1;
      next[item.type] += 1;
    }

    return next;
  }, [items, showCompleted]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      if (!query && !showCompleted && item.type === 'task' && item.done) return false;
      if (filter !== 'all' && item.type !== filter) {
        return false;
      }

      if (query && !query.split(/\s+/).every((word) => item.content.toLowerCase().includes(word))) {
        return false;
      }

      return true;
    });
  }, [filter, items, search, showCompleted]);

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending.current || !draftReady) {
      return;
    }

    sending.current = true;
    setSaving(true);
    setSaveError(null);

    try {
      const item = await addItem(trimmed, undefined, captureDraft.type);
      updateDraft({ text: '' });
      setShowTypes(false);
      setSaved(item);
      input.current?.focus();
      // One haptic, tied to the causal moment (the item landing), not a
      // decoration on every keystroke.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
      sending.current = false;
    }
  }, [addItem, captureDraft.type, draft, draftReady, updateDraft]);

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
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
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
                {search || filter !== 'all' ? 'Nothing matches' : 'A little less to remember'}
              </Text>
              <Text style={[typography.body, { color: theme.textMuted, textAlign: 'center' }]}>
                {search || filter !== 'all'
                  ? 'Try another filter or search.'
                  : 'Text it here. Pouch sorts it for you.'}
              </Text>
              {!search && filter === 'all' ? (
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {['Call the dentist tomorrow', 'Paid ₹180 for coffee', 'An idea for the weekend'].map((example) => (
                    <PressableScale disabled={saving} key={example} onPress={() => { setDraft(example); input.current?.focus(); }} style={[styles.example, { backgroundColor: theme.inputBackground }]}>
                      <Text style={{ color: theme.textMuted }}>{example}</Text>
                      <Ionicons name="add" size={16} color={theme.accent} />
                    </PressableScale>
                  ))}
                  <Text style={[typography.bodySmall, { color: theme.textMuted, textAlign: 'center' }]}>Try an example, or write your own.</Text>
                </View>
              ) : (
                <PressableScale onPress={() => { setSearch(''); setFilter('all'); }}>
                  <Text style={{ color: theme.accent, padding: spacing.md }}>Clear search & filters</Text>
                </PressableScale>
              )}
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View>
              <PouchBrand />
                <Text style={[typography.bodySmall, { color: theme.textFaint }]}>
                  A little less to keep in your head.
                </Text>
              </View>
              <PressableScale accessibilityRole="button" accessibilityLabel="Your space and settings" onPress={() => router.push('/space')} style={[styles.profileButton, { backgroundColor: theme.accentMuted }]}>
                <Ionicons name="person-outline" size={21} color={theme.accent} />
              </PressableScale>
            </View>
            <View style={[styles.searchWrap, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="search" size={17} color={theme.textFaint} style={styles.searchIcon} />
              <TextInput
                clearButtonMode="while-editing"
                placeholder="Search your pouch"
                accessibilityLabel="Search your captures"
                placeholderTextColor={theme.textFaint}
                style={[styles.searchInput, { color: theme.text }]}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <FilterBar active={filter} counts={counts} onChange={setFilter} />
            {completedCount > 0 && (filter === 'all' || filter === 'task') ? (
              <PressableScale accessibilityRole="button" onPress={() => setShowCompleted(!showCompleted)}>
                <Text style={[typography.bodySmall, { color: theme.textMuted }]}>{showCompleted ? 'Hide' : 'Show'} {completedCount} completed {completedCount === 1 ? 'task' : 'tasks'}</Text>
              </PressableScale>
            ) : null}
            {error || saveError || draftError ? (
              <Text style={[typography.bodySmall, styles.bannerError, { color: theme.danger }]}>
                {saveError ?? draftError ?? error}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            pending={pendingIds.has(item.id)}
            onOpen={() => router.push(`/item/${item.id}`)}
            onToggleDone={handleToggleDone}
          />
        )}
      />

      <View style={{ backgroundColor: theme.surface }}>
        {saved ? (
          <PressableScale accessibilityRole="button" accessibilityLiveRegion="polite" onPress={() => router.push(`/item/${saved.id}`)} style={styles.captureHint}>
            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
            <Text style={[typography.bodySmall, { color: theme.textMuted, flex: 1 }]}>Saved as {itemTypeLabel(saved.type).toLowerCase()}{pendingIds.has(saved.id) ? ' · on this device' : ''}</Text>
            <Text style={{ color: theme.accent, fontWeight: '600' }}>View</Text>
          </PressableScale>
        ) : null}
        {draft.trim() ? (
          <>
            <PressableScale accessibilityRole="button" accessibilityLabel="Change detected category" onPress={() => setShowTypes(!showTypes)} style={styles.captureHint}>
              <Ionicons name={getItemIcon(classification.type)} size={16} color={getTypeColor(classification.type)} />
              <Text style={[typography.bodySmall, { color: theme.textMuted, flex: 1 }]}>{captureDraft.type ? 'Save as' : 'Looks like a'} {itemTypeLabel(classification.type).toLowerCase()}{classification.due_at ? ` · ${formatDueDate(classification.due_at)}` : ''}</Text>
              <Text style={{ color: theme.accent }}>Change</Text>
            </PressableScale>
            {showTypes ? <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              <TypePicker value={classification.type} onChange={(type) => { updateDraft({ text: draft, type }); setShowTypes(false); }} />
              {captureDraft.type ? <PressableScale onPress={() => updateDraft({ text: draft })}><Text style={{ color: theme.accent }}>Use automatic sorting</Text></PressableScale> : null}
            </View> : null}
          </>
        ) : null}
      <View
        style={[
          styles.composer,

          {
            backgroundColor: theme.background,
            paddingBottom: spacing.md,
          },
        ]}>
        <TextInput
          ref={input}
          editable={!saving}
          maxLength={MAX_CAPTURE_LENGTH}
          accessibilityLabel="Capture a thought, link, task or expense"
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
          submitBehavior="submit"
          returnKeyType="send"
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Save capture"
          disabled={!draft.trim() || saving || !draftReady}
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
      </View>

      <View style={[styles.footerLinks, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <PressableScale onPress={() => router.push('/accounts')} scaleTo={0.95}>
          <Text style={[styles.footerLink, { color: theme.accent }]}>Accounts</Text>
        </PressableScale>
        <PressableScale onPress={() => router.push('/whatsapp')} scaleTo={0.95}>
          <Text style={[styles.footerLink, { color: theme.textMuted }]}>Add from WhatsApp</Text>
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
    flex: 1,
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  captureHint: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  example: { padding: spacing.md, borderRadius: radii.md, flexDirection: 'row', gap: spacing.lg, justifyContent: 'space-between', alignItems: 'center' },
});
