import { Injectable, Logger } from '@nestjs/common';

interface IptvChannel {
  id: string;
  name: string;
  logo: string;
  country: string;
  languages: string[];
}

/**
 * Resolves a logo URL for a channel that has no logo in the M3U source.
 * Uses the free iptv-org public channel database (~30k channels with logos).
 * Results are cached in memory for 24 hours.
 */
@Injectable()
export class LogoResolverService {
  private readonly logger = new Logger(LogoResolverService.name);
  private cache: IptvChannel[] | null = null;
  private cacheTime = 0;
  private loading = false;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000;
  private readonly API_URL = 'https://iptv-org.github.io/api/channels.json';

  async resolve(channelName: string, tvgId?: string): Promise<string | null> {
    try {
      const channels = await this.getChannels();
      if (!channels || channels.length === 0) return null;

      const needle = this.norm(channelName);

      // 1. Exact tvg-id match (most reliable)
      if (tvgId) {
        const byId = channels.find(
          c => c.id && c.logo && c.id.toLowerCase().split('.')[0] === tvgId.toLowerCase().split('.')[0],
        );
        if (byId?.logo) return byId.logo;
      }

      // 2. Exact normalized name match
      const exact = channels.find(c => c.logo && this.norm(c.name) === needle);
      if (exact) return exact.logo;

      // 3. Starts-with match (e.g. needle="bbc news" matches "bbc news hd")
      const startsWith = channels.find(c => c.logo && this.norm(c.name).startsWith(needle));
      if (startsWith) return startsWith.logo;

      // 4. Contains match (needle is inside the channel name or vice-versa)
      // Only use if needle is at least 5 chars to avoid false positives
      if (needle.length >= 5) {
        const contains = channels.find(c => {
          if (!c.logo) return false;
          const cn = this.norm(c.name);
          return cn.includes(needle) || needle.includes(cn);
        });
        if (contains) return contains.logo;
      }

      return null;
    } catch (e: any) {
      this.logger.warn(`Logo resolve failed for "${channelName}": ${e.message}`);
      return null;
    }
  }

  /** Normalize a channel name for fuzzy matching */
  private norm(name: string): string {
    return name
      .toLowerCase()
      // Strip quality/platform suffixes before matching
      .replace(/[\(\[]\s*(hd|sd|fhd|4k|uhd|720p|1080p|480p|360p|2160p)\s*[\)\]]/gi, '')
      .replace(/\s+(hd|sd|fhd|4k|uhd|720p|1080p)$/gi, '')
      // Strip common noise words
      .replace(/\b(tv|channel|ch|network|news|live)\b/g, '')
      .replace(/[\s\-_\.]+/g, ' ')
      .trim();
  }

  private async getChannels(): Promise<IptvChannel[] | null> {
    if (this.cache && Date.now() - this.cacheTime < this.CACHE_TTL) {
      return this.cache;
    }
    if (this.loading) return this.cache; // Don't double-fetch
    this.loading = true;
    try {
      const res = await fetch(this.API_URL, {
        signal: AbortSignal.timeout(20_000),
        headers: { 'User-Agent': 'SolTV-LogoResolver/1.0' },
      });
      if (!res.ok) return this.cache;
      const data: IptvChannel[] = await res.json();
      this.cache = data.filter(c => c.logo && c.name);
      this.cacheTime = Date.now();
      this.logger.log(`Logo database loaded: ${this.cache.length} channels with logos`);
      return this.cache;
    } catch (e: any) {
      this.logger.warn(`Failed to load logo database: ${e.message}`);
      return this.cache;
    } finally {
      this.loading = false;
    }
  }
}
