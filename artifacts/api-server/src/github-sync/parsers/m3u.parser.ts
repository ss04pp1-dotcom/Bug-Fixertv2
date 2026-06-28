import { Injectable } from '@nestjs/common';
import { ChannelParser, ParsedChannel } from './parser.interface';

@Injectable()
export class M3uParser implements ChannelParser {
  canParse(content: string, url: string): boolean {
    return content.trimStart().startsWith('#EXTM3U') || url.toLowerCase().includes('.m3u');
  }

  parse(content: string): ParsedChannel[] {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const channels: ParsedChannel[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('#EXTINF')) {
        const parsed = this.parseExtinf(line);

        // Scan forward: collect directive lines (#EXTVLCOPT, #KODIPROP, #EXTHTTP), then find the URL
        let j = i + 1;
        let vlcUserAgent: string | undefined;
        let vlcReferer: string | undefined;
        let vlcCookie: string | undefined;
        let kodiHeaders: Record<string, string> = {};
        let extHttpHeaders: Record<string, string> = {};

        while (j < lines.length && lines[j].startsWith('#')) {
          const commentLine = lines[j];

          // ── #EXTVLCOPT:http-user-agent=... ───────────────────────────────
          if (commentLine.startsWith('#EXTVLCOPT:')) {
            const opts = commentLine.substring('#EXTVLCOPT:'.length);
            const uaMatch  = opts.match(/^http-user-agent=(.+)$/i);
            const refMatch = opts.match(/^http-referrer?=(.+)$/i);
            const ckMatch  = opts.match(/^http-cookie=(.+)$/i);
            if (uaMatch)  vlcUserAgent = uaMatch[1].trim();
            if (refMatch) vlcReferer   = refMatch[1].trim();
            if (ckMatch)  vlcCookie    = ckMatch[1].trim();
          }

          // ── #KODIPROP:inputstream.adaptive.stream_headers=User-Agent=...&Cookie=... ──
          // Also handles manifest_headers and license_key_headers
          if (commentLine.startsWith('#KODIPROP:')) {
            const kodi = commentLine.substring('#KODIPROP:'.length);
            const headersMatch = kodi.match(
              /^inputstream\.adaptive\.(?:stream_headers|manifest_headers|license_key_headers)=(.+)$/i,
            );
            if (headersMatch) {
              kodiHeaders = {
                ...kodiHeaders,
                ...this.parseUrlEncodedHeaders(headersMatch[1].trim()),
              };
            }
          }

          // ── #EXTHTTP:{"Cookie":"...","User-Agent":"..."} ──────────────────
          if (commentLine.startsWith('#EXTHTTP:')) {
            try {
              const json = commentLine.substring('#EXTHTTP:'.length).trim();
              const obj = JSON.parse(json);
              if (obj && typeof obj === 'object') {
                for (const [k, v] of Object.entries(obj)) {
                  if (typeof v === 'string') extHttpHeaders[k.toLowerCase()] = v;
                }
              }
            } catch { /* ignore malformed JSON */ }
          }

          j++;
        }

        let link = lines[j] ?? '';

        // ── URL-pipe headers: http://stream.url|User-Agent=...&Cookie=... ──
        let pipeHeaders: Record<string, string> = {};
        if (link && !link.startsWith('#') && link.includes('|')) {
          const pipeIdx = link.indexOf('|');
          pipeHeaders = this.parseUrlEncodedHeaders(link.substring(pipeIdx + 1));
          link = link.substring(0, pipeIdx).trim();
        }

        if (link && !link.startsWith('#') && parsed.name) {
          // Priority (highest → lowest):
          //   #EXTVLCOPT > #KODIPROP > #EXTHTTP > pipe-headers > inline #EXTINF attrs
          const ua = vlcUserAgent
            ?? kodiHeaders['user-agent']
            ?? extHttpHeaders['user-agent']
            ?? pipeHeaders['user-agent']
            ?? parsed.userAgent;

          const ref = vlcReferer
            ?? kodiHeaders['referer']
            ?? kodiHeaders['referrer']
            ?? extHttpHeaders['referer']
            ?? extHttpHeaders['referrer']
            ?? pipeHeaders['referer']
            ?? pipeHeaders['referrer']
            ?? parsed.referer;

          const ck = vlcCookie
            ?? kodiHeaders['cookie']
            ?? extHttpHeaders['cookie']
            ?? pipeHeaders['cookie']
            ?? parsed.cookie;

          const origin = kodiHeaders['origin']
            ?? extHttpHeaders['origin']
            ?? pipeHeaders['origin']
            ?? parsed.origin;

          channels.push({
            name: parsed.name,
            link,
            logo: parsed.logo,
            groupCategory: parsed.groupCategory,
            userAgent: ua || undefined,
            referer: ref || undefined,
            cookie: ck || undefined,
            origin: origin || undefined,
            githubChannelId: parsed.tvgId,
          });
          i = j + 1;
          continue;
        }
      }
      i++;
    }

    return channels;
  }

  // ── Parse URL-encoded header string: "User-Agent=foo&Cookie=bar" ─────────
  private parseUrlEncodedHeaders(raw: string): Record<string, string> {
    const out: Record<string, string> = {};
    try {
      for (const pair of raw.split('&')) {
        const eq = pair.indexOf('=');
        if (eq === -1) continue;
        const key = decodeURIComponent(pair.substring(0, eq).trim()).toLowerCase();
        const val = decodeURIComponent(pair.substring(eq + 1).trim());
        if (key && val) out[key] = val;
      }
    } catch { /* ignore decode errors */ }
    return out;
  }

  private parseExtinf(line: string): {
    name: string; logo?: string; groupCategory?: string; userAgent?: string;
    referer?: string; cookie?: string; origin?: string; tvgId?: string;
  } {
    // Match attribute with double or single quotes, or unquoted value up to next space/attr
    const attr = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        // Double-quoted
        const reDouble = new RegExp(`(?:^|\\s)${key}\\s*=\\s*"([^"]*)"`, 'i');
        // Single-quoted
        const reSingle = new RegExp(`(?:^|\\s)${key}\\s*=\\s*'([^']*)'`, 'i');
        const m = line.match(reDouble) ?? line.match(reSingle);
        if (m?.[1]) return m[1].trim();
      }
      return undefined;
    };

    // ── Channel name: last comma-delimited segment ───────────────────────────
    const lastCommaIdx = line.lastIndexOf(',');
    let name = lastCommaIdx !== -1 ? line.substring(lastCommaIdx + 1).trim() : '';

    // Strip embedded image-path prefix (e.g. Toffee Live generator quirk)
    const imgPrefix = name.match(/^[^\s'"]*\.(png|jpg|jpeg|webp|gif|svg)['\s]+(.+)$/i);
    if (imgPrefix) name = imgPrefix[2].trim();

    // Fallback: use tvg-name attribute if comma-name is empty or looks like a URL
    if (!name || name.startsWith('http')) {
      const tvgName = attr('tvg-name', 'name');
      if (tvgName) name = tvgName;
    }

    // ── Logo: try multiple attribute names ───────────────────────────────────
    // Different generators use: tvg-logo, logo, channel-logo, tvg-icon, icon
    const logo = attr('tvg-logo', 'logo', 'channel-logo', 'tvg-icon', 'icon');

    // ── tvg-id: stable channel identifier (never fall back to tvg-name — it's the display name) ──
    const tvgId = attr('tvg-id', 'id');

    // ── group/category ───────────────────────────────────────────────────────
    const groupCategory = attr('group-title', 'group', 'category') || undefined;

    // ── User-Agent: many M3U generators use different attribute names ─────────
    // inline in #EXTINF: user-agent="...", useragent="...", http-user-agent="..."
    const userAgent = attr('user-agent', 'useragent', 'http-user-agent', 'ua') || undefined;

    // ── Referer ──────────────────────────────────────────────────────────────
    const referer = attr('referrer', 'referer', 'http-referrer', 'http-referer', 'origin') || undefined;

    // ── Cookie ───────────────────────────────────────────────────────────────
    const cookie = attr('cookie', 'http-cookie', 'cookies') || undefined;

    // ── Origin ───────────────────────────────────────────────────────────────
    const origin = attr('origin', 'http-origin') || undefined;

    return { name, logo, tvgId, groupCategory, userAgent, referer, cookie, origin };
  }
}
