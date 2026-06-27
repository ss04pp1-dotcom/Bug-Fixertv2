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

    // Standard M3U: channel name is everything after the last comma on the line
    let name = line.includes(',') ? line.split(',').slice(1).join(',').trim() : '';

    // Some M3U generators (e.g. Toffee Live) embed the poster path in the name field:
    //   "q_75f_webp/.../poster.png'Ekhon TV"  or  "/posters/abc.png Ekhon TV"
    // Strip any leading image-path prefix that ends with a known image extension
    // followed by an optional single-quote or space, then the real name.
    const imgPrefix = name.match(/^[^\s'"]*\.(png|jpg|jpeg|webp|gif|svg)['\s]+(.+)$/i);
    if (imgPrefix) {
      name = imgPrefix[2].trim();
    }

    // If tvg-name is present and looks like a real name (no slashes / http),
    // prefer it over the comma-extracted name.
    const tvgName = attr('tvg-name');
    if (tvgName && !tvgName.includes('/') && !tvgName.startsWith('http')) {
      name = tvgName.trim();
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
