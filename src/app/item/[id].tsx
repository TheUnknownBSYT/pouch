import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DateField } from '@/components/date-field';
import { PressableScale } from '@/components/pressable-scale';
import { RichContentDetail } from '@/components/rich-content';
import { TypePicker } from '@/components/type-picker';
import { PriorityPicker } from '@/components/priority-picker';
import { getItemIcon, getTypeTint, radii, shadows, spacing, useThemeColors } from '@/constants/ui';
import { useItems } from '@/contexts/ItemsContext';
import { supabase } from '@/lib/supabase';
import { callPhone, openWhatsApp } from '@/lib/contacts';
import {
  formatSignedAmount,
  itemTypeLabel,
} from '@/lib/classifyItem';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { setItemType } from '@/lib/items';
import { extractFirstUrl, normalizeUrl, openLink } from '@/lib/urls';
import type { AccountSlug, Item, ItemType, TaskPriority, TransactionDirection } from '@/types/item';
import { ACCOUNT_LABELS } from '@/types/item';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = useThemeColors(isDark);
  const { items, saveItem, removeItem } = useItems();

  const cachedItem = useMemo(() => items.find((row) => row.id === id) ?? null, [id, items]);

  const [item, setItem] = useState<Item | null>(cachedItem);
  const [content, setContent] = useState(cachedItem?.content ?? '');
  const [occurredAt, setOccurredAt] = useState(
    new Date(cachedItem?.occurred_at ?? cachedItem?.created_at ?? Date.now()),
  );
  const [account, setAccount] = useState<AccountSlug>(cachedItem?.account ?? 'cash');
  const [direction, setDirection] = useState<TransactionDirection>(cachedItem?.direction ?? 'out');
  const [amount, setAmount] = useState(cachedItem?.amount != null ? String(cachedItem.amount) : '');
  const [priority, setPriority] = useState<TaskPriority>(cachedItem?.priority ?? 'low');
  const [dueAt, setDueAt] = useState<Date | null>(
    cachedItem?.due_at ? new Date(cachedItem.due_at) : null,
  );
  const [loading, setLoading] = useState(!cachedItem);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cachedItem) {
      return;
    }

    setItem(cachedItem);
    setContent(cachedItem.content);
    setOccurredAt(new Date(cachedItem.occurred_at ?? cachedItem.created_at));
    setAccount(cachedItem.account ?? 'cash');
    setDirection(cachedItem.direction ?? 'out');
    setAmount(cachedItem.amount != null ? String(cachedItem.amount) : '');
    setPriority(cachedItem.priority ?? 'low');
    setDueAt(cachedItem.due_at ? new Date(cachedItem.due_at) : null);
    setLoading(false);
  }, [cachedItem]);

  useEffect(() => {
    if (!id || cachedItem) {
      return;
    }

    let cancelled = false;

    async function loadItem() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single();

      if (cancelled) {
        return;
      }

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const loaded = data as Item;
      setItem(loaded);
      setContent(loaded.content);
      setOccurredAt(new Date(loaded.occurred_at ?? loaded.created_at));
      setAccount(loaded.account ?? 'cash');
      setDirection(loaded.direction ?? 'out');
      setAmount(loaded.amount != null ? String(loaded.amount) : '');
      setPriority(loaded.priority ?? 'low');
      setDueAt(loaded.due_at ? new Date(loaded.due_at) : null);
      setLoading(false);
    }

    void loadItem();

    return () => {
      cancelled = true;
    };
  }, [cachedItem, id]);

  const linkUrl = useMemo(
    () => (item?.type === 'link' ? extractFirstUrl(item.content) : null),
    [item],
  );

  const handleSave = useCallback(async () => {
    if (!item || saving) {
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      setError('Content cannot be empty');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Parameters<typeof saveItem>[1] = {
        content: trimmed,
        occurred_at: occurredAt.toISOString(),
      };

      if (item.type === 'expense') {
        const parsedAmount = amount.trim()
          ? Number.parseFloat(amount.replace(/,/g, ''))
          : null;
        if (amount.trim() && (!Number.isFinite(parsedAmount!) || parsedAmount! <= 0)) {
          setError('Enter a valid amount');
          setSaving(false);
          return;
        }
        payload.amount = parsedAmount;
        payload.account = account;
        payload.direction = direction;
        payload.type = 'expense';
      }

      if (item.type === 'task') {
        payload.priority = priority;
        payload.due_at = dueAt?.toISOString() ?? null;
      }

      const updated = await saveItem(item.id, payload);
      setItem(updated);
      setContent(updated.content);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [account, amount, content, direction, dueAt, item, occurredAt, priority, saveItem, saving]);

  const handleToggleDone = useCallback(async () => {
    if (!item || item.type !== 'task') {
      return;
    }

    try {
      const updated = await saveItem(item.id, { done: !item.done });
      setItem(updated);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  }, [item, saveItem]);

  const handleTypeChange = useCallback(
    async (type: ItemType) => {
      if (!item || item.type === type) {
        return;
      }

      try {
        const updated = await setItemType(item.id, type, {
          content,
          amount: item.amount,
          account: item.account,
          direction: item.direction,
          priority: item.priority,
          due_at: item.due_at,
        });
        setItem(updated);
        if (updated.type === 'expense') {
          setAccount(updated.account ?? 'cash');
          setDirection(updated.direction ?? 'out');
          setAmount(updated.amount != null ? String(updated.amount) : '');
        }
        if (updated.type === 'task') {
          setPriority(updated.priority ?? 'low');
          setDueAt(updated.due_at ? new Date(updated.due_at) : null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to change type');
      }
    },
    [content, item],
  );

  const handleDelete = useCallback(async () => {
    if (!item) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await removeItem(item.id);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowDeleteDialog(false);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
    }
  }, [item, removeItem, router]);

  const handleOpenLink = useCallback(async () => {
    if (!linkUrl) {
      return;
    }

    try {
      await openLink(linkUrl);
    } catch {
      await Linking.openURL(normalizeUrl(linkUrl));
    }
  }, [linkUrl]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textMuted }}>Item not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            saving ? <ActivityIndicator color={theme.accent} style={styles.headerSpinner} /> : null,
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.metaCard, shadows.card, { backgroundColor: theme.surface }]}>
          <View style={styles.metaRow}>
            <View style={[styles.metaIcon, { backgroundColor: getTypeTint(item.type, isDark) }]}>
              <Ionicons color={theme.accent} name={getItemIcon(item.type)} size={16} />
            </View>
            <Text style={[styles.metaText, { color: theme.text }]}>
              {itemTypeLabel(item.type)}
              {item.type === 'expense' && item.amount != null && item.direction
                ? ` · ${formatSignedAmount(item.amount, item.direction)}`
                : ''}
            </Text>
          </View>
          <Text style={[styles.metaSubtext, { color: theme.textFaint }]}>
            {formatRelativeTime(item.occurred_at ?? item.created_at)}
            {item.source ? ` · ${item.source}` : ''}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Type</Text>
          <TypePicker value={item.type} onChange={handleTypeChange} />
        </View>

        <DateField label="Date" value={occurredAt} onChange={setOccurredAt} />

        {linkUrl ? (
          <PressableScale
            onPress={() => void handleOpenLink()}
            style={[styles.openLinkButton, { backgroundColor: theme.accent }]}>
            <Ionicons color="#FFFFFF" name="open-outline" size={18} />
            <Text numberOfLines={1} style={styles.openLinkText}>
              Open link
            </Text>
          </PressableScale>
        ) : null}

        {item.type === 'task' ? (
          <View style={[styles.taskCard, shadows.card, { backgroundColor: theme.surface }]}>
            <View style={styles.taskRow}>
              <Text style={[styles.taskLabel, { color: theme.text }]}>Done</Text>
              <Switch
                value={item.done}
                onValueChange={() => void handleToggleDone()}
                trackColor={{ false: theme.border, true: theme.accent }}
              />
            </View>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Priority</Text>
              <PriorityPicker value={priority} onChange={setPriority} />
            </View>
            {dueAt ? (
              <DateField label="Due date" value={dueAt} onChange={setDueAt} />
            ) : (
              <PressableScale
                scaleTo={0.98}
                onPress={() => setDueAt(new Date())}
                style={[styles.addDueButton, { borderColor: theme.borderStrong }]}>
                <Text style={{ color: theme.accent, fontWeight: '700' }}>+ Add due date</Text>
              </PressableScale>
            )}
          </View>
        ) : null}

        {item.type === 'contact' ? (
          <View style={styles.contactRow}>
            <PressableScale
              onPress={() => void callPhone(item.content)}
              style={[styles.openLinkButton, { backgroundColor: theme.accent, flex: 1 }]}>
              <Ionicons color="#FFFFFF" name="call-outline" size={18} />
              <Text style={styles.openLinkText}>Call</Text>
            </PressableScale>
            <PressableScale
              onPress={() => void openWhatsApp(item.content)}
              style={[styles.openLinkButton, { backgroundColor: '#25D366', flex: 1 }]}>
              <Ionicons color="#FFFFFF" name="logo-whatsapp" size={18} />
              <Text style={styles.openLinkText}>WhatsApp</Text>
            </PressableScale>
          </View>
        ) : null}

        {item.type === 'expense' ? (
          <View style={[styles.expenseCard, shadows.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Transaction</Text>
            <TextInput
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor={theme.textFaint}
              style={[styles.amountInput, { backgroundColor: theme.inputBackground, color: theme.text }]}
              value={amount}
              onChangeText={setAmount}
            />
            <View style={styles.optionRow}>
              {(['cash', 'gpay'] as AccountSlug[]).map((slug) => (
                <PressableScale
                  key={slug}
                  scaleTo={0.96}
                  onPress={() => setAccount(slug)}
                  style={[
                    styles.optionChip,
                    { backgroundColor: account === slug ? theme.accent : theme.inputBackground },
                  ]}>
                  <Text style={{ color: account === slug ? '#FFFFFF' : theme.text, fontWeight: '700' }}>
                    {ACCOUNT_LABELS[slug]}
                  </Text>
                </PressableScale>
              ))}
            </View>
            <View style={styles.optionRow}>
              {(['out', 'in'] as TransactionDirection[]).map((value) => (
                <PressableScale
                  key={value}
                  scaleTo={0.96}
                  onPress={() => setDirection(value)}
                  style={[
                    styles.optionChip,
                    { backgroundColor: direction === value ? theme.accent : theme.inputBackground },
                  ]}>
                  <Text style={{ color: direction === value ? '#FFFFFF' : theme.text, fontWeight: '700' }}>
                    {value === 'in' ? 'Money in' : 'Money out'}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.previewCard, shadows.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Preview</Text>
          <RichContentDetail
            content={content}
            style={item.type === 'quote' ? styles.quoteInput : undefined}
          />
        </View>

        <TextInput
          multiline
          style={[
            styles.contentInput,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            item.type === 'task' && item.done ? styles.doneText : null,
          ]}
          value={content}
          onChangeText={setContent}
          textAlignVertical="top"
        />

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <PressableScale
          onPress={() => void handleSave()}
          style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
          <Text style={styles.primaryButtonText}>Save changes</Text>
        </PressableScale>

        <PressableScale
          scaleTo={0.96}
          onPress={() => setShowDeleteDialog(true)}
          style={styles.deleteButton}>
          <Text style={[styles.deleteButtonText, { color: theme.danger }]}>Delete item</Text>
        </PressableScale>
      </ScrollView>

      <ConfirmDialog
        visible={showDeleteDialog}
        title="Delete item?"
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  headerSpinner: {
    marginRight: spacing.sm,
  },
  metaCard: {
    borderRadius: radii.lg,
    gap: spacing.xs + 2,
    padding: spacing.md + 2,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metaIcon: {
    alignItems: 'center',
    borderRadius: radii.sm,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  metaText: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaSubtext: {
    fontSize: 13,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewCard: {
    borderRadius: radii.xl,
    gap: spacing.sm + 2,
    padding: spacing.lg,
  },
  openLinkButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  openLinkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  taskCard: {
    borderRadius: radii.xl,
    gap: spacing.md + 2,
    padding: spacing.lg,
  },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addDueButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: spacing.md + 2,
  },
  contactRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  taskLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  expenseCard: {
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.md + 2,
  },
  amountInput: {
    borderRadius: radii.sm,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionChip: {
    alignItems: 'center',
    borderRadius: radii.full,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  contentInput: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 17,
    lineHeight: 26,
    minHeight: 200,
    padding: spacing.lg,
  },
  linkInput: {
    color: '#2563EB',
  },
  quoteInput: {
    fontStyle: 'italic',
  },
  doneText: {
    opacity: 0.55,
    textDecorationLine: 'line-through',
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
