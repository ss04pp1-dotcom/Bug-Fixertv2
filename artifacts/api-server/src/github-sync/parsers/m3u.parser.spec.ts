import { M3uParser } from './m3u.parser';

describe('M3uParser', () => {
  let parser: M3uParser;

  beforeEach(() => {
    parser = new M3uParser();
  });

  // ── canParse ───────────────────────────────────────────────────────────────
  describe('canParse()', () => {
    it('returns true when content starts with #EXTM3U', () => {
      expect(parser.canParse('#EXTM3U\n#EXTINF:-1,Ch\nhttp://x', 'file.txt')).toBe(true);
    });

    it('returns true when URL contains .m3u (case-insensitive)', () => {
      expect(parser.canParse('', 'https://cdn.example.com/playlist.M3U')).toBe(true);
    });

    it('returns true when URL contains .m3u8', () => {
      expect(parser.canParse('', 'https://cdn.example.com/list.m3u8')).toBe(true);
    });

    it('returns false for plain JSON content with non-m3u URL', () => {
      expect(parser.canParse('[{"name":"x"}]', 'https://example.com/channels.json')).toBe(false);
    });
  });

  // ── parse ──────────────────────────────────────────────────────────────────
  describe('parse()', () => {
    it('parses a minimal EXTINF + URL entry', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1,Sony HD\nhttp://stream.test/sony';
      const result = parser.parse(m3u);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Sony HD');
      expect(result[0].link).toBe('http://stream.test/sony');
    });

    it('extracts tvg-logo as logo', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1 tvg-logo="http://logo.com/l.png",Channel\nhttp://s/ch';
      expect(parser.parse(m3u)[0].logo).toBe('http://logo.com/l.png');
    });

    it('extracts tvg-id as githubChannelId', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1 tvg-id="cnn-us",CNN\nhttp://s/cnn';
      expect(parser.parse(m3u)[0].githubChannelId).toBe('cnn-us');
    });

    it('sets githubChannelId to undefined when tvg-id is absent', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1,Channel\nhttp://s/ch';
      expect(parser.parse(m3u)[0].githubChannelId).toBeUndefined();
    });

    it('extracts user-agent attribute', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1 user-agent="MyApp/1.0",Ch\nhttp://s/ch';
      expect(parser.parse(m3u)[0].userAgent).toBe('MyApp/1.0');
    });

    it('extracts useragent attribute (alternate spelling)', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1 useragent="AltApp/2.0",Ch\nhttp://s/ch';
      expect(parser.parse(m3u)[0].userAgent).toBe('AltApp/2.0');
    });

    it('extracts referrer as referer', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1 referrer="https://ref.com",Ch\nhttp://s/ch';
      expect(parser.parse(m3u)[0].referer).toBe('https://ref.com');
    });

    it('extracts referer attribute (alternate spelling)', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1 referer="https://ref2.com",Ch\nhttp://s/ch';
      expect(parser.parse(m3u)[0].referer).toBe('https://ref2.com');
    });

    it('extracts cookie attribute', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1 cookie="session=abc123",Ch\nhttp://s/ch';
      expect(parser.parse(m3u)[0].cookie).toBe('session=abc123');
    });

    it('extracts origin attribute', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1 origin="https://origin.com",Ch\nhttp://s/ch';
      expect(parser.parse(m3u)[0].origin).toBe('https://origin.com');
    });

    it('parses multiple entries in order', () => {
      const m3u = [
        '#EXTM3U',
        '#EXTINF:-1,Channel A', 'http://s/a',
        '#EXTINF:-1,Channel B', 'http://s/b',
        '#EXTINF:-1,Channel C', 'http://s/c',
      ].join('\n');
      const result = parser.parse(m3u);
      expect(result).toHaveLength(3);
      expect(result.map(c => c.name)).toEqual(['Channel A', 'Channel B', 'Channel C']);
    });

    it('handles channel names that contain commas', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1,Sony HD, Premium Edition\nhttp://s/sony';
      expect(parser.parse(m3u)[0].name).toBe('Sony HD, Premium Edition');
    });

    it('skips #EXTVLCOPT and other comment-lines between EXTINF and URL', () => {
      const m3u = [
        '#EXTM3U',
        '#EXTINF:-1,Channel A',
        '#EXTVLCOPT:network-caching=1000',
        'http://s/a',
      ].join('\n');
      const result = parser.parse(m3u);
      expect(result).toHaveLength(1);
      expect(result[0].link).toBe('http://s/a');
    });

    it('skips a trailing EXTINF entry that has no URL after it', () => {
      // Channel A is valid (URL follows it). The trailing EXTINF has no URL and
      // should be silently dropped.
      const m3u = '#EXTM3U\n#EXTINF:-1,Channel A\nhttp://s/a\n#EXTINF:-1,Trailing No URL';
      const result = parser.parse(m3u);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Channel A');
      expect(result[0].link).toBe('http://s/a');
    });

    it('returns empty array when content has no valid entries', () => {
      expect(parser.parse('#EXTM3U\n# just a comment\n')).toHaveLength(0);
    });

    it('returns empty array for completely empty content', () => {
      expect(parser.parse('')).toHaveLength(0);
    });

    it('trims whitespace from channel names', () => {
      const m3u = '#EXTM3U\n#EXTINF:-1,  Sony HD  \nhttp://s/sony';
      expect(parser.parse(m3u)[0].name).toBe('Sony HD');
    });

    it('handles CRLF line endings', () => {
      const m3u = '#EXTM3U\r\n#EXTINF:-1,Channel\r\nhttp://s/ch\r\n';
      const result = parser.parse(m3u);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Channel');
    });

    it('deduplication: same tvg-id on two entries both get githubChannelId set', () => {
      const m3u = [
        '#EXTM3U',
        '#EXTINF:-1 tvg-id="cnn",CNN HD', 'http://s/cnn1',
        '#EXTINF:-1 tvg-id="cnn",CNN SD', 'http://s/cnn2',
      ].join('\n');
      const result = parser.parse(m3u);
      expect(result).toHaveLength(2);
      expect(result[0].githubChannelId).toBe('cnn');
      expect(result[1].githubChannelId).toBe('cnn');
    });
  });
});
