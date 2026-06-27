import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  success: boolean;
  httpStatus?: number;
  responseTimeMs: number;
  failReason?: string;
  isHlsPlaylist: boolean;
  playlistSegmentCount: number;
}

export interface ValidationHeaders {
  cookie?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  origin?: string | null;
}

/**
 * Parse cookie expiry from two common formats:
 *  1. CDN signed cookie:  "Edge-Cache-Cookie=URLPrefix=...:Expires=1782699104:..."  (Unix seconds)
 *  2. Standard HTTP:      "session=abc; expires=Thu, 01 Jan 2026 00:00:00 GMT"
 */
export function parseCookieExpiry(cookie: string): Date | null {
  const unixMatch = cookie.match(/:Expires=(\d{8,11})(?::|$)/i);
  if (unixMatch) {
    const ts = parseInt(unixMatch[1], 10);
    if (!isNaN(ts) && ts > 0) return new Date(ts * 1000);
  }
  const httpMatch = cookie.match(/(?:^|;\s*)expires=([^;]+)/i);
  if (httpMatch) {
    const d = new Date(httpMatch[1].trim());
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function isCookieExpired(cookie: string): boolean {
  const expiry = parseCookieExpiry(cookie);
  if (!expiry) return false;
  return expiry.getTime() < Date.now();
}

export function cookieExpiryInfo(cookie: string): { expired: boolean; expiresAt: Date | null } {
  const expiresAt = parseCookieExpiry(cookie);
  return { expired: expiresAt ? expiresAt.getTime() < Date.now() : false, expiresAt };
}

@Injectable()
export class StreamValidationService {
  private readonly logger = new Logger(StreamValidationService.name);
  private readonly TIMEOUT_MS = 10_000;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1_000;

  /**
   * Validate a stream URL, optionally passing server-specific headers.
   * If a cookie is present and already expired, returns immediately with
   * failReason 'Cookie Expired' — no HTTP request is made.
   */
  async validateWithHeaders(streamUrl: string, headers?: ValidationHeaders): Promise<ValidationResult> {
    if (headers?.cookie && isCookieExpired(headers.cookie)) {
      const info = cookieExpiryInfo(headers.cookie);
      const expiredSince = info.expiresAt
        ? info.expiresAt.toISOString().substring(0, 10)
        : 'unknown date';
      return {
        success: false,
        responseTimeMs: 0,
        failReason: `Cookie Expired (since ${expiredSince})`,
        isHlsPlaylist: false,
        playlistSegmentCount: 0,
      };
    }
    return this.validate(streamUrl, headers);
  }

  async validate(streamUrl: string, headers?: ValidationHeaders): Promise<ValidationResult> {
    let lastError: string | undefined;
    let lastHttpStatus: number | undefined;
    let bestResult: ValidationResult | undefined;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        this.logger.debug(`Retry ${attempt}/${this.MAX_RETRIES} for ${streamUrl}`);
        await this.sleep(this.RETRY_DELAY_MS * attempt);
      }

      try {
        const result = await this.validateSingle(streamUrl, headers);
        if (result.success) {
          return result;
        }
        lastError = result.failReason;
        lastHttpStatus = result.httpStatus;
        bestResult = result;
      } catch (err: any) {
        lastError = err?.message ?? 'Unknown error';
        lastHttpStatus = undefined;
      }
    }

    return bestResult ?? {
      success: false,
      httpStatus: lastHttpStatus,
      responseTimeMs: 0,
      failReason: lastError || 'All retries failed',
      isHlsPlaylist: false,
      playlistSegmentCount: 0,
    };
  }

  private async validateSingle(streamUrl: string, headers?: ValidationHeaders): Promise<ValidationResult> {
    const startTime = Date.now();

    // Step 1: URL validation
    try {
      new URL(streamUrl);
    } catch {
      return {
        success: false,
        responseTimeMs: Date.now() - startTime,
        failReason: 'Invalid URL',
        isHlsPlaylist: false,
        playlistSegmentCount: 0,
      };
    }

    // Step 2: HTTP request with timeout
    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      response = await fetch(streamUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': headers?.userAgent || 'StreamPro-Validator/1.0',
          'Accept': '*/*',
          ...(headers?.cookie  ? { Cookie:  headers.cookie  } : {}),
          ...(headers?.referer ? { Referer: headers.referer } : {}),
          ...(headers?.origin  ? { Origin:  headers.origin  } : {}),
        },
      });

      clearTimeout(timeoutId);
    } catch (err: any) {
      const reason = err?.name === 'AbortError'
        ? 'Timeout (10s)'
        : err?.code === 'ENOTFOUND'
          ? 'DNS Error'
          : err?.code === 'ECONNREFUSED'
            ? 'Connection Failed'
            : err?.code === 'ENETUNREACH'
              ? 'Network Unreachable'
              : `Connection Error: ${err?.message ?? 'Unknown'}`;

      return {
        success: false,
        responseTimeMs: Date.now() - startTime,
        failReason: reason,
        isHlsPlaylist: false,
        playlistSegmentCount: 0,
      };
    }

    const responseTimeMs = Date.now() - startTime;
    const httpStatus = response.status;

    // Step 3: Check HTTP status
    if (httpStatus === 404) {
      return { success: false, httpStatus, responseTimeMs, failReason: '404 Not Found', isHlsPlaylist: false, playlistSegmentCount: 0 };
    }
    if (httpStatus === 403) {
      return { success: false, httpStatus, responseTimeMs, failReason: '403 Forbidden', isHlsPlaylist: false, playlistSegmentCount: 0 };
    }
    if (httpStatus >= 500) {
      return { success: false, httpStatus, responseTimeMs, failReason: `${httpStatus} Server Error`, isHlsPlaylist: false, playlistSegmentCount: 0 };
    }
    if (httpStatus >= 400) {
      return { success: false, httpStatus, responseTimeMs, failReason: `${httpStatus} Client Error`, isHlsPlaylist: false, playlistSegmentCount: 0 };
    }

    // Step 4: Check content type and HLS validity
    const contentType = response.headers.get('content-type') ?? '';
    const isHlsUrl = streamUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('vnd.apple.mpegurl') || contentType.includes('application/x-mpegURL');

    if (isHlsUrl) {
      try {
        const body = await response.text();
        const trimmed = body.trim();

        if (!trimmed || trimmed.length < 7) {
          return { success: false, httpStatus, responseTimeMs, failReason: 'Empty Playlist', isHlsPlaylist: true, playlistSegmentCount: 0 };
        }

        const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
        const segmentCount = lines.length;

        // A valid HLS playlist should have at least one segment OR be a master playlist (contains #EXT-X-STREAM-INF)
        const isMasterPlaylist = trimmed.includes('#EXT-X-STREAM-INF');
        if (segmentCount > 0 || isMasterPlaylist) {
          return { success: true, httpStatus, responseTimeMs, isHlsPlaylist: true, playlistSegmentCount: segmentCount };
        }

        return { success: false, httpStatus, responseTimeMs, failReason: 'Invalid Playlist (no segments)', isHlsPlaylist: true, playlistSegmentCount: 0 };
      } catch {
        // If we can't read the body but got 200, consider it potentially working
        return { success: true, httpStatus, responseTimeMs, isHlsPlaylist: true, playlistSegmentCount: -1 };
      }
    }

    // For non-HLS streams, 200 OK is sufficient
    return { success: true, httpStatus, responseTimeMs, isHlsPlaylist: false, playlistSegmentCount: 0 };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}