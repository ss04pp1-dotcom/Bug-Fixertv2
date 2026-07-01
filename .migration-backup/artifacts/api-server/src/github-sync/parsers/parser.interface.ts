export interface ParsedChannel {
  name: string;
  link: string;
  logo?: string;
  groupCategory?: string;
  cookie?: string;
  userAgent?: string;
  referer?: string;
  origin?: string;
  githubChannelId?: string;
}

export interface ChannelParser {
  canParse(content: string, url: string): boolean;
  parse(content: string): ParsedChannel[];
}
