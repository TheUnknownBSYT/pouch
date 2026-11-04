import type { ItemSource } from '@/types/item';

type SharedContent = {
  text?: string | null;
  webUrl?: string | null;
  meta?: { title?: string } | null;
};

/** Keep the caption as well as the URL; never save a temporary file path as a note. */
export function normalizeSharedContent(share: SharedContent): string | null {
  const text = share.text?.trim() ?? '';
  const url = share.webUrl?.trim() ?? '';
  const title = share.meta?.title?.trim() ?? '';
  if (!text && !url) return null;

  const parts = text ? [text] : [];
  if (url && !text.includes(url)) parts.push(url);
  if (title && (!text || text === url) && title !== url) parts.unshift(title);
  return parts.join('\n');
}

/** Share titles are page titles, not reliable identifiers of the sending app. */
export function inferShareSource(content: string): ItemSource {
  const urls = content.match(/https?:\/\/[^\s]+/gi) ?? [];
  for (const value of urls) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      const isDomain = (domain: string) => host === domain || host.endsWith(`.${domain}`);
      if (isDomain('instagram.com')) return 'share-instagram';
      if (isDomain('youtube.com') || isDomain('youtu.be')) return 'share-youtube';
      if (isDomain('whatsapp.com') || isDomain('wa.me')) return 'share-whatsapp';
    } catch {
      // Plain text shares are valid too.
    }
  }
  return 'share';
}
