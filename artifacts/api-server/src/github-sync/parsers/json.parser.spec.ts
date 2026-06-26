import { JsonParser } from './json.parser';

describe('JsonParser', () => {
  let parser: JsonParser;

  beforeEach(() => {
    parser = new JsonParser();
  });

  // ── canParse ───────────────────────────────────────────────────────────────
  describe('canParse()', () => {
    it('returns true for content that starts with [', () => {
      expect(parser.canParse('[{"name":"x"}]', 'file.txt')).toBe(true);
    });

    it('returns true for content that starts with {', () => {
      expect(parser.canParse('{"channels":[]}', 'file.txt')).toBe(true);
    });

    it('returns true for URL ending in .json (case-insensitive)', () => {
      expect(parser.canParse('', 'https://cdn.example.com/list.JSON')).toBe(true);
    });

    it('returns false for M3U content with non-json URL', () => {
      expect(parser.canParse('#EXTM3U\n...', 'https://example.com/channels.m3u')).toBe(false);
    });
  });

  // ── parse — root formats ───────────────────────────────────────────────────
  describe('parse() — root format detection', () => {
    it('parses a root-level array', () => {
      const json = JSON.stringify([{ name: 'Sony HD', link: 'http://s/sony' }]);
      const result = parser.parse(json);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Sony HD');
      expect(result[0].link).toBe('http://s/sony');
    });

    it('parses { channels: [] } wrapper', () => {
      const json = JSON.stringify({ channels: [{ name: 'CNN', link: 'http://s/cnn' }] });
      expect(parser.parse(json)).toHaveLength(1);
    });

    it('parses { data: [] } wrapper', () => {
      const json = JSON.stringify({ data: [{ name: 'BBC', link: 'http://s/bbc' }] });
      expect(parser.parse(json)).toHaveLength(1);
    });

    it('parses { items: [] } wrapper', () => {
      const json = JSON.stringify({ items: [{ name: 'Sky', link: 'http://s/sky' }] });
      expect(parser.parse(json)).toHaveLength(1);
    });

    it('returns empty array for an unknown wrapper object with no array key', () => {
      const json = JSON.stringify({ playlist: [{ name: 'X', link: 'http://x' }] });
      expect(parser.parse(json)).toHaveLength(0);
    });
  });

  // ── parse — field mapping ──────────────────────────────────────────────────
  describe('parse() — field mapping', () => {
    it('maps "title" to name when "name" is absent', () => {
      const json = JSON.stringify([{ title: 'Discovery', link: 'http://s/disc' }]);
      expect(parser.parse(json)[0].name).toBe('Discovery');
    });

    it('maps "channelName" to name when "name" and "title" are absent', () => {
      const json = JSON.stringify([{ channelName: 'ESPN', link: 'http://s/espn' }]);
      expect(parser.parse(json)[0].name).toBe('ESPN');
    });

    it('maps "url" to link when "link" is absent', () => {
      const json = JSON.stringify([{ name: 'Ch', url: 'http://s/ch' }]);
      expect(parser.parse(json)[0].link).toBe('http://s/ch');
    });

    it('maps "streamUrl" to link', () => {
      const json = JSON.stringify([{ name: 'Ch', streamUrl: 'http://s/ch' }]);
      expect(parser.parse(json)[0].link).toBe('http://s/ch');
    });

    it('maps "stream_url" to link', () => {
      const json = JSON.stringify([{ name: 'Ch', stream_url: 'http://s/ch' }]);
      expect(parser.parse(json)[0].link).toBe('http://s/ch');
    });

    it('maps item.id to githubChannelId as a string', () => {
      const json = JSON.stringify([{ id: 42, name: 'Ch', link: 'http://s/ch' }]);
      expect(parser.parse(json)[0].githubChannelId).toBe('42');
    });

    it('sets githubChannelId to undefined when id is absent', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s/ch' }]);
      expect(parser.parse(json)[0].githubChannelId).toBeUndefined();
    });

    it('maps "logo" field', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s', logo: 'http://logo.com/a.png' }]);
      expect(parser.parse(json)[0].logo).toBe('http://logo.com/a.png');
    });

    it('maps "logoUrl" field', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s', logoUrl: 'http://logo.com/b.png' }]);
      expect(parser.parse(json)[0].logo).toBe('http://logo.com/b.png');
    });

    it('maps "logo_url" field', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s', logo_url: 'http://logo.com/c.png' }]);
      expect(parser.parse(json)[0].logo).toBe('http://logo.com/c.png');
    });

    it('maps "thumbnail" to logo as fallback', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s', thumbnail: 'http://thumb.com/t.png' }]);
      expect(parser.parse(json)[0].logo).toBe('http://thumb.com/t.png');
    });

    it('maps "userAgent" field', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s', userAgent: 'MyApp/1.0' }]);
      expect(parser.parse(json)[0].userAgent).toBe('MyApp/1.0');
    });

    it('maps "user_agent" field', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s', user_agent: 'MyApp/2.0' }]);
      expect(parser.parse(json)[0].userAgent).toBe('MyApp/2.0');
    });

    it('maps "referer" field', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s', referer: 'https://ref.com' }]);
      expect(parser.parse(json)[0].referer).toBe('https://ref.com');
    });

    it('maps "referrer" field', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s', referrer: 'https://ref2.com' }]);
      expect(parser.parse(json)[0].referer).toBe('https://ref2.com');
    });

    it('maps "cookie" field', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s', cookie: 'sess=xyz' }]);
      expect(parser.parse(json)[0].cookie).toBe('sess=xyz');
    });

    it('maps "origin" field', () => {
      const json = JSON.stringify([{ name: 'Ch', link: 'http://s', origin: 'https://origin.com' }]);
      expect(parser.parse(json)[0].origin).toBe('https://origin.com');
    });

    it('trims whitespace from name and link', () => {
      const json = JSON.stringify([{ name: '  Sony HD  ', link: '  http://s/sony  ' }]);
      const ch = parser.parse(json)[0];
      expect(ch.name).toBe('Sony HD');
      expect(ch.link).toBe('http://s/sony');
    });
  });

  // ── parse — filtering ──────────────────────────────────────────────────────
  describe('parse() — filtering invalid items', () => {
    it('skips items missing all name/title/channelName fields', () => {
      const json = JSON.stringify([{ link: 'http://x' }]);
      expect(parser.parse(json)).toHaveLength(0);
    });

    it('skips items missing all link/url/streamUrl/stream_url fields', () => {
      const json = JSON.stringify([{ name: 'Ch' }]);
      expect(parser.parse(json)).toHaveLength(0);
    });

    it('skips null entries in the array', () => {
      const json = JSON.stringify([null, { name: 'Ch', link: 'http://s' }]);
      expect(parser.parse(json)).toHaveLength(1);
    });

    it('skips non-object array entries (strings, numbers)', () => {
      const json = JSON.stringify(['not-an-object', 42, { name: 'Ch', link: 'http://s' }]);
      expect(parser.parse(json)).toHaveLength(1);
    });
  });

  // ── parse — error handling ─────────────────────────────────────────────────
  describe('parse() — error handling', () => {
    it('returns empty array for invalid JSON', () => {
      expect(parser.parse('not json at all')).toHaveLength(0);
    });

    it('returns empty array for a JSON null root', () => {
      expect(parser.parse('null')).toHaveLength(0);
    });

    it('returns empty array for a JSON string root', () => {
      expect(parser.parse('"just a string"')).toHaveLength(0);
    });

    it('returns empty array for a JSON number root', () => {
      expect(parser.parse('42')).toHaveLength(0);
    });

    it('returns empty array for an empty array', () => {
      expect(parser.parse('[]')).toHaveLength(0);
    });

    it('handles a large valid array (5,000 entries) without error', () => {
      const items = Array.from({ length: 5_000 }, (_, i) => ({
        name: `Channel ${i}`,
        link: `http://stream.example.com/${i}`,
      }));
      const result = parser.parse(JSON.stringify(items));
      expect(result).toHaveLength(5_000);
    });
  });

  // ── parse — deduplication input ────────────────────────────────────────────
  describe('parse() — deduplication inputs (Scenarios 3 & 4)', () => {
    it('preserves exact names so normalizeName upstream can deduplicate', () => {
      const json = JSON.stringify([
        { name: 'Sony HD',  link: 'http://s/1' },
        { name: 'SONY HD',  link: 'http://s/2' },
        { name: 'Sony-HD',  link: 'http://s/3' },
        { name: 'Sony_HD',  link: 'http://s/4' },
      ]);
      const result = parser.parse(json);
      expect(result).toHaveLength(4);
      // Parser preserves original names; dedup happens in the service via normalizeName
      expect(result.map(r => r.name)).toEqual(['Sony HD', 'SONY HD', 'Sony-HD', 'Sony_HD']);
    });
  });
});
