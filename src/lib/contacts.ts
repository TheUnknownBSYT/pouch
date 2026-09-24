const PHONE_PATTERN =
  /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|\b[6-9]\d{9}\b|\+\d{1,3}[\s-]?\d{6,14}\b/;

export function extractPhoneNumber(content: string): string | null {
  const match = content.match(PHONE_PATTERN);
  if (!match) {
    return null;
  }

  const digits = match[0].replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    return digits;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return digits;
}

export async function callPhone(content: string): Promise<void> {
  const phone = extractPhoneNumber(content);
  if (!phone) {
    return;
  }

  const { Linking } = await import('react-native');
  await Linking.openURL(`tel:${phone}`);
}

export async function openWhatsApp(content: string): Promise<void> {
  const phone = extractPhoneNumber(content);
  if (!phone) {
    return;
  }

  const digits = phone.replace(/\D/g, '');
  const { Linking } = await import('react-native');
  await Linking.openURL(`https://wa.me/${digits}`);
}
