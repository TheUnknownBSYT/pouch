import { inferShareSource, normalizeSharedContent } from './shared-content';
import { redirectSystemPath } from '../app/+native-intent';

describe('phone share capture', () => {
  it('keeps a caption and the shared URL without duplicating it', () => {
    expect(normalizeSharedContent({ text: 'Watch later', webUrl: 'https://youtu.be/abc' }))
      .toBe('Watch later\nhttps://youtu.be/abc');
    expect(normalizeSharedContent({ text: 'Watch https://youtu.be/abc', webUrl: 'https://youtu.be/abc' }))
      .toBe('Watch https://youtu.be/abc');
  });

  it('preserves a web page title and handles empty text', () => {
    expect(normalizeSharedContent({ text: '', webUrl: 'https://example.com', meta: { title: 'Article' } }))
      .toBe('Article\nhttps://example.com');
    expect(normalizeSharedContent({ text: '  a thought  ' })).toBe('a thought');
    expect(normalizeSharedContent({})).toBeNull();
  });

  it('infers provenance from URL hosts, not arbitrary titles or lookalike domains', () => {
    expect(inferShareSource('https://www.instagram.com/reel/123')).toBe('share-instagram');
    expect(inferShareSource('https://youtu.be/abc')).toBe('share-youtube');
    expect(inferShareSource('https://wa.me/919876543210')).toBe('share-whatsapp');
    expect(inferShareSource('Instagram tips https://example.com')).toBe('share');
    expect(inferShareSource('https://youtube.com.example.com')).toBe('share');
  });

  it('routes cold and warm share callbacks into the inbox', () => {
    for (const initial of [true, false]) {
      expect(redirectSystemPath({ path: 'pouch://dataUrl=pouchShareKey?nonce=123#text', initial })).toBe('/');
      expect(redirectSystemPath({ path: 'pouch://auth/callback#access_token=example', initial })).toBe('/auth');
      expect(redirectSystemPath({ path: '/item/123', initial })).toBe('/item/123');
    }
  });
});
