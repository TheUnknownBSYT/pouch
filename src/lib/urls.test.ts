import { splitContentByUrls } from './urls';

describe('splitContentByUrls', () => {
  it('keeps label text separate from the URL', () => {
    const segments = splitContentByUrls('youtube https://www.youtube.com/watch?v=abc');
    expect(segments).toEqual([
      { type: 'text', value: 'youtube ' },
      {
        type: 'link',
        value: 'https://www.youtube.com/watch?v=abc',
        url: 'https://www.youtube.com/watch?v=abc',
      },
    ]);
  });

  it('handles plain text with no URLs', () => {
    expect(splitContentByUrls('just a note')).toEqual([{ type: 'text', value: 'just a note' }]);
  });
});
