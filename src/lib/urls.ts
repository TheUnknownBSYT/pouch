/**
 * URL helpers — find links inside free-form text and open them.
 *
 * Used by RichContent so only the URL turns blue, not words like "youtube" before it.
 */

/** Matches http(s) URLs, www., and common bare domains (youtube.com, etc.) */
const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(com|org|net|io|app|dev|co|in|me|tv|ly)(?:\/[^\s]*)?/gi;

export type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; url: string };

/** First URL in a string, or null. */
export function extractFirstUrl(content: string): string | null {
  const pattern = new RegExp(URL_PATTERN.source, 'i');
  const match = content.match(pattern);
  if (!match) {
    return null;
  }
  return normalizeUrl(match[0]);
}

/** Split "youtube https://youtube.com/..." into plain text + link segments for styled rendering. */
export function splitContentByUrls(content: string): ContentSegment[] {
  const pattern = new RegExp(URL_PATTERN.source, 'gi');
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, start) });
    }
    const raw = match[0];
    segments.push({ type: 'link', value: raw, url: normalizeUrl(raw) });
    lastIndex = start + raw.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: content }];
}

export function normalizeUrl(url: string): string {
  const trimmed = url.replace(/[.,;:!?)]+$/, '');
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export async function openLink(url: string): Promise<void> {
  const { openBrowserAsync } = await import('expo-web-browser');
  await openBrowserAsync(normalizeUrl(url));
}
