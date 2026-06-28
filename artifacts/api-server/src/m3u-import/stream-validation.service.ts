import { Injectable, Logger } from '@nestjs/common';
import * as dns from 'dns';
import * as net from 'net';

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

// Cap response body reads to 64KB — protects the validator from being used as an
// amplifier in a malicious-stream SSRF/exfiltration attack (an attacker could submit
// a URL pointing at a multi-gigabyte internal resource and OOM the API server).
const MAX_BODY_BYTES = 64 * 1024;

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
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(streamUrl);
    } catch {
      return {
        success: false,
        responseTimeMs: Date.now() - startTime,
        failReason: 'Invalid URL',
        isHlsPlaylist: false,
        playlistSegmentCount: 0,
      };
    }

    // Step 1b: SSRF protection — resolve the hostname via dns.lookup and reject private/loopback IPs.
    // Without this, an attacker could submit "http://169.254.169.254/latest/meta-data/"
    // (AWS/Azure/GCP metadata) or "http://localhost:6379/" (internal Redis) and the server would
    // happily fetch and return the response body. We block 127/8, 10/8, 172.16/12, 192.168/16,
    // 169.254/16 (link-local + cloud metadata), ::1, and fc00::/7 (IPv6 ULA).
    try {
      const isPrivate = await this.resolvesToPrivateIp(parsedUrl.hostname);
      if (isPrivate) {
        return {
          success: false,
          responseTimeMs: Date.now() - startTime,
          failReason: 'SSRF blocked: URL resolves to private IP',
          isHlsPlaylist: false,
          playlistSegmentCount: 0,
        };
      }
    } catch (err: any) {
      // DNS resolution failed — return the original error so the caller can see why.
      return {
        success: false,
        responseTimeMs: Date.now() - startTime,
        failReason: `DNS Error: ${err?.message ?? 'lookup failed'}`,
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
        // Cap body read to MAX_BODY_BYTES (64KB) — protects the validator from large-response
        // amplification. HLS playlists are tiny (<32KB typically); 64KB is generous.
        const body = await this.readCappedText(response, MAX_BODY_BYTES);
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

  /**
   * Resolve `hostname` and return true if any resolved address is in a private/loopback/link-local range.
   * Catches DNS rebinding attacks where the first A record is public but the second is 169.254.169.254.
   */
  private resolvesToPrivateIp(hostname: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Strip IPv6 brackets if present.
      const host = hostname.replace(/^\[|\]$/g, '');
      // If the input is already a literal IP, check it directly.
      if (net.isIP(host)) {
        resolve(this.isPrivateIp(host));
        return;
      }
      dns.lookup(host, { all: true, family: 0 }, (err, addresses) => {
        if (err) return reject(err);
        if (addresses.length === 0) return resolve(false);
        resolve(addresses.some(a => this.isPrivateIp(a.address)));
      });
    });
  }

  /**
   * Returns true if `ip` is in a private / loopback / link-local / ULA range that should never
   * be reachable from a public stream URL. AWS/Azure/GCP metadata services live at 169.254.169.254.
   */
  private isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
      const octets = ip.split('.').map(Number);
      if (octets.length !== 4 || octets.some(o => Number.isNaN(o))) return false;
      const [a, b] = octets;
      // 127.0.0.0/8 — loopback
      if (a === 127) return true;
      // 10.0.0.0/8 — RFC1918
      if (a === 10) return true;
      // 172.16.0.0/12 — RFC1918
      if (a === 172 && b >= 16 && b <= 31) return true;
      // 192.168.0.0/16 — RFC1918
      if (a === 192 && b === 168) return true;
      // 169.254.0.0/16 — link-local (includes AWS/Azure/GCP metadata service at 169.254.169.254)
      if (a === 169 && b === 254) return true;
      // 0.0.0.0/8 — "this network"
      if (a === 0) return true;
      return false;
    }
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      // ::1 — loopback
      if (lower === '::1') return true;
      // fc00::/7 — unique local addresses (RFC4193)
      if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
      // fe80::/10 — link-local
      if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
      return false;
    }
    return false;
  }

  /**
   * Read at most `maxBytes` from a Response body as text. If the body is larger, the read is
   * truncated at the cap and the underlying stream is cancelled to avoid buffering the rest.
   */
  private async readCappedText(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) return '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let received = 0;
    let text = '';
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        text += decoder.decode(value, { stream: true });
        if (received >= maxBytes) {
          // Hit the cap — stop reading and cancel the stream.
          await reader.cancel().catch(() => {});
          break;
        }
      }
      text += decoder.decode(); // flush
    } finally {
      try { reader.releaseLock(); } catch { /* noop */ }
    }
    return text;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}