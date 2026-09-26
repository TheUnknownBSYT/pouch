import { Ionicons } from '@expo/vector-icons';
import type { ItemType, TaskPriority } from '@/types/item';

const ICONS: Record<ItemType, keyof typeof Ionicons.glyphMap> = {
  note: 'document-text-outline',
  link: 'link-outline',
  task: 'checkbox-outline',
  expense: 'cash-outline',
  unsorted: 'ellipse-outline',
  contact: 'person-outline',
  quote: 'chatbubble-ellipses-outline',
};

// Slightly desaturated / deepened versions of the originals — reads as considered
// rather than "default Tailwind palette."
const TYPE_COLORS: Record<ItemType, string> = {
  note: '#677168',
  link: '#286447',
  task: '#946722',
  expense: '#286447',
  unsorted: '#737C74',
  contact: '#677168',
  quote: '#677168',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#737C74',
  medium: '#946722',
  high: '#B34436',
};

export function getItemIcon(type: ItemType): keyof typeof Ionicons.glyphMap {
  return ICONS[type];
}

export function getTypeColor(type: ItemType): string {
  return TYPE_COLORS[type];
}

export function getPriorityColor(priority: TaskPriority): string {
  return PRIORITY_COLORS[priority];
}

/**
 * Type badges get a muted "chip" background (12% of the type color over the
 * surface) instead of bare colored text — reads as a considered UI decision
 * rather than a raw hex value dropped on a label.
 */
export function getTypeTint(type: ItemType, isDark: boolean): string {
  return `${TYPE_COLORS[type]}${isDark ? '2E' : '17'}`;
}

export function getPriorityTint(priority: TaskPriority, isDark: boolean): string {
  return `${PRIORITY_COLORS[priority]}${isDark ? '2E' : '17'}`;
}

// 4px base scale — keeps every gap/padding value intentional instead of ad hoc.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 999,
};

export const typography = {
  display: {
    fontSize: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: -0.1,
  },
  /** Amounts and dates — tabular figures so columns of numbers align. */
  numeric: {
    fontVariant: ['tabular-nums' as const],
  },
};

export const colors = {
  background: '#F7F6F2',
  surface: '#FFFFFF',
  border: '#DEE2D9',
  borderStrong: '#C8CFC4',
  text: '#202A23',
  textMuted: '#677168',
  textFaint: '#737C74',
  accent: '#286447',
  onAccent: '#FFFFFF',
  accentMuted: '#E7EFE5',
  danger: '#B34436',
  dangerMuted: '#F9EAE5',
  inputBackground: '#EEEFE8',
  success: '#286447',
};

export const darkColors = {
  background: '#151A17',
  surface: '#1E2520',
  border: '#354139',
  borderStrong: '#4A594E',
  text: '#F1F4EE',
  textMuted: '#ACB7AD',
  textFaint: '#99A59A',
  accent: '#70BA90',
  onAccent: '#10281B',
  accentMuted: '#263F30',
  danger: '#FF6369',
  dangerMuted: '#3A1E20',
  inputBackground: '#29322C',
  success: '#70BA90',
};

export const shadows = {
  // Barely-there — separates a card from the background without shouting.
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 3,
    elevation: 0,
  },
  // Sheets, dialogs — things that float above the whole screen.
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 12,
  },
};

export function useThemeColors(isDark: boolean) {
  return isDark ? darkColors : colors;
}
