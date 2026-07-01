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
    // Standard M3U: channel name is after the last comma on the #EXTINF line
    const commaIndex = extinfLine.lastIndexOf(',');
    let name = commaIndex !== -1 ? extinfLine.substring(commaIndex + 1).trim() : '';

    // Some M3U generators (e.g. Toffee Live) embed a poster path in the name field:
    //   "q_75f_webp/.../poster.png'Ekhon TV"  or  "/posters/abc.png Ekhon TV"
    // Strip the image-path prefix that ends with a known extension then ' or whitespace.
    const imgPrefix = name.match(/^[^\s'"]*\.(png|jpg|jpeg|webp|gif|svg)['\s]+(.+)$/i);
    if (imgPrefix) {
      name = imgPrefix[2].trim();
    }

    if (name) return name;

    // Fallback: prefer tvg-name if it looks like a real channel name (not a URL/path)
    const tvgName = this.extractAttribute(extinfLine, 'tvg-name');
    if (tvgName && !tvgName.includes('/') && !tvgName.startsWith('http')) {
      return tvgName.trim();
    }

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