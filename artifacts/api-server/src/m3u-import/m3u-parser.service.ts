import { Injectable, Logger } from '@nestjs/common';

export interface ParsedM3uChannel {
  name: string;
  logoUrl: string | null;
  groupCategory: string | null;
  streamUrl: string;
}

@Injectable()
export class M3uParserService {
  private readonly logger = new Logger(M3uParserService.name);

  parse(m3uContent: string): ParsedM3uChannel[] {
    const lines = m3uContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const channels: ParsedM3uChannel[] = [];

    if (lines.length === 0 || lines[0] !== '#EXTM3U') {
      this.logger.warn('File does not start with #EXTM3U — attempting to parse anyway');
    }

    let currentChannel: Partial<ParsedM3uChannel> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('#EXTINF:')) {
        // Parse #EXTINF attributes
        const name = this.extractChannelName(line);
        const logoUrl = this.extractAttribute(line, 'tvg-logo');
        const groupCategory = this.extractAttribute(line, 'group-title');

        currentChannel = { name, logoUrl, groupCategory };
      } else if (line.startsWith('#')) {
        // Skip other directives
        continue;
      } else if (currentChannel && line.startsWith('http')) {
        currentChannel.streamUrl = line;
        if (currentChannel.name && currentChannel.streamUrl) {
          channels.push(currentChannel as ParsedM3uChannel);
        }
        currentChannel = null;
      }
    }

    this.logger.log(`Parsed ${channels.length} channels from M3U content`);
    return channels;
  }

  private extractChannelName(extinfLine: string): string {
    // Format: #EXTINF:-1 tvg-id="..." tvg-name="..." ...,Channel Name
    // The name is after the last comma
    const commaIndex = extinfLine.lastIndexOf(',');
    if (commaIndex !== -1) {
      const name = extinfLine.substring(commaIndex + 1).trim();
      if (name) return name;
    }
    // Fallback to tvg-name attribute
    const tvgName = this.extractAttribute(extinfLine, 'tvg-name');
    return tvgName || 'Unknown Channel';
  }

  private extractAttribute(line: string, attr: string): string | null {
    // Match attr="value" or attr='value'
    const patterns = [
      new RegExp(`${attr}="([^"]*)"`, 'i'),
      new RegExp(`${attr}='([^']*)'`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) return match[1] || null;
    }
    return null;
  }
}