import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface YoutubeStreamResult {
  streamUrl: string;
  title: string;
  thumbnail: string;
  duration: number;
  isLive: boolean;
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  extractVideoId(url: string): string | null {
    if (!url) return null;
    const patterns = [
      /youtu\.be\/([^?&#]+)/,
      /youtube\.com\/watch\?v=([^&#]+)/,
      /youtube\.com\/shorts\/([^?&#]+)/,
      /youtube\.com\/embed\/([^?&#]+)/,
      /youtube\.com\/v\/([^?&#]+)/,
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m?.[1]) return m[1];
    }
    return null;
  }

  async extractStream(youtubeUrl: string): Promise<YoutubeStreamResult> {
    const videoId = this.extractVideoId(youtubeUrl);
    if (!videoId) throw new Error('Invalid YouTube URL');

    // Try yt-dlp if available on the server
    try {
      return await this.extractWithYtDlp(youtubeUrl);
    } catch (ytdlpErr) {
      this.logger.warn(`yt-dlp failed: ${ytdlpErr instanceof Error ? ytdlpErr.message : String(ytdlpErr)}`);
    }

    // Fallback: use innertube (YouTube's internal API)
    return await this.extractWithInnertube(videoId);
  }

  private async extractWithYtDlp(url: string): Promise<YoutubeStreamResult> {
    // yt-dlp must be installed on the server (pip install yt-dlp)
    // Returns JSON with all stream info
    const cmd = `yt-dlp --no-warnings --print-json -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "${url}" 2>&1 | head -1`;
    const { stdout } = await execAsync(cmd, { timeout: 30000 });
    const info = JSON.parse(stdout.trim());

    const streamUrl = info.url || info.manifest_url;
    if (!streamUrl) throw new Error('yt-dlp: no stream URL in output');

    return {
      streamUrl,
      title: info.title || '',
      thumbnail: info.thumbnail || `https://img.youtube.com/vi/${this.extractVideoId(url)}/hqdefault.jpg`,
      duration: info.duration || 0,
      isLive: !!info.is_live,
    };
  }

  private async extractWithInnertube(videoId: string): Promise<YoutubeStreamResult> {
    // YouTube's web client innertube API — no binary dependency
    const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    const payload = {
      videoId,
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '17.31.35',
          androidSdkVersion: 30,
          userAgent: 'com.google.android.youtube/17.31.35 (Linux; U; Android 11) gzip',
          hl: 'en',
          gl: 'US',
        },
      },
    };

    const resp = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/17.31.35 (Linux; U; Android 11) gzip',
          'X-Youtube-Client-Name': '3',
          'X-Youtube-Client-Version': '17.31.35',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!resp.ok) throw new Error(`Innertube HTTP ${resp.status}`);
    const data: any = await resp.json();

    const status = data?.playabilityStatus?.status;
    if (status === 'UNPLAYABLE' || status === 'LOGIN_REQUIRED') {
      throw new Error(`Video not available: ${status}`);
    }

    // Pick best adaptive or progressive stream
    const formats: any[] = [
      ...(data?.streamingData?.adaptiveFormats ?? []),
      ...(data?.streamingData?.formats ?? []),
    ];

    // Prefer mp4 with audio
    const progressive = formats.filter(
      f => f.mimeType?.includes('video/mp4') && f.audioQuality,
    );
    const best =
      progressive.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0] ||
      formats[0];

    if (!best?.url) {
      // Try HLS manifest
      const hlsUrl = data?.streamingData?.hlsManifestUrl;
      if (hlsUrl) {
        const vd = data?.videoDetails ?? {};
        return {
          streamUrl: hlsUrl,
          title: vd.title ?? '',
          thumbnail:
            vd.thumbnail?.thumbnails?.slice(-1)[0]?.url ??
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration: parseInt(vd.lengthSeconds ?? '0', 10),
          isLive: !!vd.isLive,
        };
      }
      throw new Error('No playable stream found via innertube');
    }

    const vd = data?.videoDetails ?? {};
    return {
      streamUrl: best.url,
      title: vd.title ?? '',
      thumbnail:
        vd.thumbnail?.thumbnails?.slice(-1)[0]?.url ??
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: parseInt(vd.lengthSeconds ?? '0', 10),
      isLive: !!vd.isLive,
    };
  }
}
