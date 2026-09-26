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
  note: '#6E62E8',
  link: '#0C9BDE',
  task: '#E0900A',
  expense: '#12A16B',
  unsorted: '#9A9AA6',
  contact: '#E8578F',
  quote: '#8562EA',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#9A9AA6',
  medium: '#E0900A',
  high: '#E5484D',
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
  full: 999,
};

export const typography = {
  display: {
    fontSize: 30,
    fontWeight: '800' as const,
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
  background: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#EBEBEF',
  borderStrong: '#DEDEE4',
  text: '#131316',
  textMuted: '#6F6F79',
  textFaint: '#A8A8B3',
  accent: '#5750E8',
  accentMuted: '#EFEEFE',
  danger: '#E5484D',
  dangerMuted: '#FCEBEC',
  inputBackground: '#F3F3F5',
  success: '#12A16B',
};

export const darkColors = {
  background: '#0A0A0C',
  surface: '#161618',
  border: '#26262A',
  borderStrong: '#35353A',
  text: '#F5F5F7',
  textMuted: '#9E9EA8',
  textFaint: '#68686F',
  accent: '#8A83F7',
  accentMuted: '#211F3D',
  danger: '#FF6369',
  dangerMuted: '#3A1E20',
  inputBackground: '#1F1F22',
  success: '#3DD68C',
};

export const shadows = {
  // Barely-there — separates a card from the background without shouting.
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
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
