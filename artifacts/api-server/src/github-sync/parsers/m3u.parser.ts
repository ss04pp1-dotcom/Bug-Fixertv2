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
    const attr = (key: string) => {
      const re = new RegExp(`${key}="([^"]*)"`, 'i');
      const m = line.match(re);
      return m?.[1] || undefined;
    };

    const name = line.includes(',') ? line.split(',').slice(1).join(',').trim() : '';

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
