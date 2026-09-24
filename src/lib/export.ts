import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { monthLabel } from '@/lib/accounts';

export async function downloadCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const uri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export transactions',
    });
  }
}

export function exportFilename(year: number, month: number): string {
  const slug = monthLabel(year, month).toLowerCase().replace(/\s+/g, '-');
  return `pouch-${slug}.csv`;
}
