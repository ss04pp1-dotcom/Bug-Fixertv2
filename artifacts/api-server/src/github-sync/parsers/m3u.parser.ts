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
        // Next non-comment line is the URL
        let j = i + 1;
        while (j < lines.length && lines[j].startsWith('#')) j++;
        const link = lines[j];

        if (link && !link.startsWith('#') && parsed.name) {
          channels.push({
            name: parsed.name,
            link: link,
            logo: parsed.logo,
            userAgent: parsed.userAgent,
            referer: parsed.referer,
            cookie: parsed.cookie,
            origin: parsed.origin,
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

  private parseExtinf(line: string): {
    name: string; logo?: string; userAgent?: string;
    referer?: string; cookie?: string; origin?: string; tvgId?: string;
  } {
    // Match attributes in both double-quotes and single-quotes
    const attr = (key: string): string | undefined => {
      const reDouble = new RegExp(`${key}="([^"]*)"`, 'i');
      const reSingle = new RegExp(`${key}='([^']*)'`, 'i');
      const m = line.match(reDouble) ?? line.match(reSingle);
      return m?.[1] || undefined;
    };

    // Standard M3U: channel name is always the text after the LAST comma.
    // tvg-name is intentionally NOT used as a name override — it may contain
    // a category label or match-title (e.g. "Fifa World Cup") that differs
    // from the true per-stream name after the comma (e.g. "Toffee 1").
    let name = line.includes(',') ? line.split(',').slice(1).join(',').trim() : '';

    // Some M3U generators (e.g. Toffee Live) embed the poster path directly
    // in the display-name field:
    //   "q_75f_webp/.../poster.png'Ekhon TV"  or  "/posters/abc.png Ekhon TV"
    // Strip the leading image-path prefix (anything up to a known image extension
    // followed by a single-quote or whitespace) to recover the real name.
    const imgPrefix = name.match(/^[^\s'"]*\.(png|jpg|jpeg|webp|gif|svg)['\s]+(.+)$/i);
    if (imgPrefix) {
      name = imgPrefix[2].trim();
    }

    return {
      name,
      logo: attr('tvg-logo'),
      tvgId: attr('tvg-id'),
      userAgent: attr('user-agent') || attr('useragent'),
      referer: attr('referrer') || attr('referer'),
      cookie: attr('cookie'),
      origin: attr('origin'),
    };
  }
}
