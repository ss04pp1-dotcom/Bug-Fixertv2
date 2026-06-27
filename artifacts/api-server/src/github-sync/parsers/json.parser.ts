import { Injectable, Logger } from '@nestjs/common';
import { ChannelParser, ParsedChannel } from './parser.interface';

@Injectable()
export class JsonParser implements ChannelParser {
  private readonly logger = new Logger(JsonParser.name);

  canParse(content: string, url: string): boolean {
    const trimmed = content.trimStart();
    return trimmed.startsWith('[') || trimmed.startsWith('{') || url.toLowerCase().includes('.json');
  }

  parse(content: string): ParsedChannel[] {
    let raw: any;
    try {
      raw = JSON.parse(content);
    } catch (e) {
      this.logger.warn('JSON parse failed');
      return [];
    }

    // Support: array at root, or { channels: [] }, or { data: [] }, or { items: [] }
    const arr: any[] = Array.isArray(raw)
      ? raw
      : raw?.channels ?? raw?.data ?? raw?.items ?? [];

    const channels: ParsedChannel[] = [];

    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;

      const name = item.name ?? item.title ?? item.channelName;
      const link = item.link ?? item.url ?? item.streamUrl ?? item.stream_url;

      if (!name || !link) continue;

      channels.push({
        name: String(name).trim(),
        link: String(link).trim(),
        logo: item.logo ?? item.logoUrl ?? item.logo_url ?? item.thumbnail ?? undefined,
        groupCategory: item['group-title'] ?? item.group ?? item.groupTitle ?? item.group_title ?? item.category ?? undefined,
        cookie: item.cookie ?? undefined,
        userAgent: item.userAgent ?? item.user_agent ?? undefined,
        referer: item.referer ?? item.referrer ?? undefined,
        origin: item.origin ?? undefined,
        githubChannelId: item.id ? String(item.id) : undefined,
      });
    }

    return channels;
  }
}
