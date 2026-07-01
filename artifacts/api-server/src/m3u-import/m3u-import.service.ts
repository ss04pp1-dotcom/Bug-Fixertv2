import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { M3uParserService, ParsedM3uChannel } from './m3u-parser.service';
import { StreamValidationService, ValidationResult } from './stream-validation.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { StreamType, ChannelStreamStatus, ImportJobStatus, ImportChannelStatus, ServerSourceType } from '@prisma/client';
import { normalizeName } from '../github-sync/github-sync.service';

export const QUEUE_M3U_IMPORT = 'm3u-import';
export const QUEUE_HEALTH_CHECK = 'health-check';

interface ImportJobData {
  importJobId: string;
  filePath: string;
}

interface HealthCheckJobData {
  channelIds?: string[];
  offlineOnly?: boolean;
}

@Injectable()
export class M3uImportService {
  private readonly logger = new Logger(M3uImportService.name);
  private readonly UPLOAD_DIR = join(process.cwd(), 'uploads', 'm3u');

  constructor(
    private prisma: PrismaService,
    private m3uParser: M3uParserService,
    private streamValidation: StreamValidationService,
    @Optional() @InjectQueue(QUEUE_M3U_IMPORT) private importQueue: Queue | null,
    @Optional() @InjectQueue(QUEUE_HEALTH_CHECK) private healthQueue: Queue | null,
  ) {
    // Ensure upload directory exists
    if (!existsSync(this.UPLOAD_DIR)) {
      mkdirSync(this.UPLOAD_DIR, { recursive: true });
    }
  }

  // ─── M3U Upload & Queue ──────────────────────────────────────

  async uploadM3u(file: Express.Multer.File, batchSize: number = 50, saveFailed: boolean = false) {
    if (!file) throw new BadRequestException('No file provided');
    if (!file.originalname?.toLowerCase().endsWith('.m3u') && !file.originalname?.toLowerCase().endsWith('.m3u8')) {
      throw new BadRequestException('Only .m3u and .m3u8 files are supported');
    }

    // Save file
    const fileHash = createHash('md5').update(Date.now().toString()).digest('hex').substring(0, 8);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${fileHash}_${safeName}`;
    const filePath = join(this.UPLOAD_DIR, storedName);

    await fsPromises.writeFile(filePath, file.buffer);

    // Create import job record
    const job = await this.prisma.importJob.create({
      data: {
        filename: file.originalname,
        filePath,
        fileSize: file.size,
        batchSize,
        saveFailed,
        status: ImportJobStatus.pending,
      },
    });

    // Enqueue background job (fallback to direct processing when Redis unavailable)
    if (this.importQueue) {
      await this.importQueue.add('process-import', {
        importJobId: job.id,
        filePath,
      } as ImportJobData, {
        attempts: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      });
      this.logger.log(`M3U upload queued via Redis: job=${job.id}, file=${file.originalname}`);
    } else {
      // No Redis — process in-process asynchronously (fire-and-forget)
      this.logger.warn(`Redis unavailable — processing import job ${job.id} in-process`);
      setImmediate(() => {
        this.processImportJob(job.id, filePath).catch((err) =>
          this.logger.error(`In-process import job ${job.id} failed: ${err?.message}`, err?.stack),
        );
      });
    }

    return { importJobId: job.id, filename: file.originalname, message: 'Upload successful. Processing started in background.' };
  }

  // ─── Background Import Processor ─────────────────────────────

  async processImportJob(importJobId: string, filePath: string) {
    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: { status: ImportJobStatus.parsing, startedAt: new Date() },
    });

    try {
      // Parse M3U file
      const content = await fsPromises.readFile(filePath, 'utf-8');
      const channels = this.m3uParser.parse(content);

      if (channels.length === 0) {
        await this.prisma.importJob.update({
          where: { id: importJobId },
          data: { status: ImportJobStatus.completed, completedAt: new Date(), errorMessage: 'No valid channels found in file' },
        });
        return;
      }

      // Update job with total count
      const job = await this.prisma.importJob.update({
        where: { id: importJobId },
        data: { status: ImportJobStatus.validating, totalChannels: channels.length },
      });

      // Create import channel records in batches for memory efficiency
      const BATCH_INSERT_SIZE = 500;
      for (let i = 0; i < channels.length; i += BATCH_INSERT_SIZE) {
        const batch = channels.slice(i, i + BATCH_INSERT_SIZE);
        await this.prisma.importChannel.createMany({
          data: batch.map((ch) => ({
            importJobId,
            channelName: ch.name,
            streamUrl: ch.streamUrl,
            logoUrl: ch.logoUrl,
            groupCategory: ch.groupCategory,
            status: ImportChannelStatus.pending,
          })),
        });
      }

      // Process in validation batches
      await this.processValidationBatches(importJobId, job.batchSize, job.saveFailed);

      // Mark as completing (finalizing)
      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: { status: ImportJobStatus.completing },
      });

      // Cleanup file
      try { await fsPromises.unlink(filePath); } catch {}

      // Mark completed
      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: { status: ImportJobStatus.completed, completedAt: new Date() },
      });

    } catch (err: any) {
      this.logger.error(`Import job ${importJobId} failed: ${err?.message}`, err.stack);
      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: { status: ImportJobStatus.failed, completedAt: new Date(), errorMessage: err?.message ?? 'Unknown error' },
      });
    }
  }

  private async processValidationBatches(importJobId: string, batchSize: number, saveFailed: boolean) {
    let hasMore = true;

    while (hasMore) {
      // Check if job was cancelled
      const job = await this.prisma.importJob.findUnique({ where: { id: importJobId } });
      if (!job || job.status === ImportJobStatus.cancelled) {
        this.logger.log(`Import job ${importJobId} was cancelled`);
        return;
      }

      // Fetch next batch of pending channels
      const pendingChannels = await this.prisma.importChannel.findMany({
        where: { importJobId, status: ImportChannelStatus.pending },
        take: batchSize,
        orderBy: { createdAt: 'asc' },
      });

      if (pendingChannels.length === 0) {
        hasMore = false;
        break;
      }

      // Validate concurrently (10 at a time per batch)
      const CONCURRENCY = 10;
      for (let i = 0; i < pendingChannels.length; i += CONCURRENCY) {
        const chunk = pendingChannels.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map((ch) => this.validateAndSave(ch, importJobId, saveFailed)));
      }

      // Update job counters
      const counts = await this.prisma.importChannel.groupBy({
        by: ['status'],
        where: { importJobId },
        _count: true,
      });

      const updateData: any = {};
      for (const c of counts) {
        if (c.status === ImportChannelStatus.active) updateData.activeChannels = c._count;
        if (c.status === ImportChannelStatus.failed) updateData.failedChannels = c._count;
        if (c.status === ImportChannelStatus.skipped) updateData.skippedChannels = c._count;
      }
      updateData.checkedChannels = await this.prisma.importChannel.count({
        where: { importJobId, status: { not: ImportChannelStatus.pending } },
      });

      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: updateData,
      });
    }
  }

  private async validateAndSave(
    importChannel: { id: string; channelName: string; streamUrl: string; logoUrl: string | null; groupCategory: string | null },
    importJobId: string,
    saveFailed: boolean,
  ) {
    // Mark as checking
    await this.prisma.importChannel.update({
      where: { id: importChannel.id },
      data: { status: ImportChannelStatus.checking },
    });

    // Check for duplicate stream URL within same import job
    const duplicateInJob = await this.prisma.importChannel.findFirst({
      where: {
        importJobId,
        streamUrl: importChannel.streamUrl,
        status: { in: [ImportChannelStatus.active, ImportChannelStatus.skipped] },
        id: { not: importChannel.id },
      },
    });
    if (duplicateInJob) {
      await this.prisma.importChannel.update({
        where: { id: importChannel.id },
        data: { status: ImportChannelStatus.skipped, failReason: 'Duplicate stream URL in same import' },
      });
      return;
    }

    const result: ValidationResult = await this.streamValidation.validate(importChannel.streamUrl);

    if (result.success) {
      // Find or create category
      let categoryId: string | undefined;
      if (importChannel.groupCategory) {
        const catSlug = importChannel.groupCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `cat-${Date.now()}`;
        const cat = await this.prisma.category.upsert({
          where: { slug: catSlug },
          create: { name: importChannel.groupCategory, slug: catSlug },
          update: {},
        });
        categoryId = cat.id;
      }

      // Check for duplicate stream URL
      const existing = await this.prisma.channel.findFirst({
        where: { primaryStreamUrl: importChannel.streamUrl, deletedAt: null },
        include: { category: { select: { name: true } } },
      });

      let channelId: string | undefined;

      if (existing) {
        // Smart duplicate resolution: new import validated OK (active), update existing to active
        // If existing was inactive/offline, this import "revives" it
        await this.prisma.channel.update({
          where: { id: existing.id },
          data: {
            streamStatus: ChannelStreamStatus.active,
            isActive: true,
            lastActiveAt: new Date(),
            logo: importChannel.logoUrl || existing.logo,
          },
        });
        channelId = existing.id;
      } else {
        // Check for same normalized name — if found (active), add as a new server instead of new channel
        const normalized = normalizeName(importChannel.channelName);
        const sameNameActive = normalized
          ? await this.prisma.channel.findFirst({
              where: { normalizedName: normalized, deletedAt: null },
            })
          : null;

        if (sameNameActive) {
          // Channel exists — add the new stream URL as a ChannelServer (avoid duplicate server links)
          const existingServer = await this.prisma.channelServer.findFirst({
            where: { channelId: sameNameActive.id, link: importChannel.streamUrl, deletedAt: null },
          });
          if (!existingServer) {
            await this.prisma.channelServer.create({
              data: {
                channelId: sameNameActive.id,
                link: importChannel.streamUrl,
                priority: 100,
                sourceType: ServerSourceType.ADMIN,
                healthCheckEnabled: true,
                enabled: true,
                createdBySync: false,
              },
            });
          }
          // Update logo/category if missing on the parent channel
          await this.prisma.channel.update({
            where: { id: sameNameActive.id },
            data: {
              logo: importChannel.logoUrl || sameNameActive.logo || undefined,
              categoryId: categoryId || sameNameActive.categoryId || undefined,
              streamStatus: ChannelStreamStatus.active,
              isActive: true,
              lastActiveAt: new Date(),
            },
          });
          channelId = sameNameActive.id;
        } else {
          // Check for duplicate by name — if same name channel exists and is OFFLINE, replace it
          const sameNameOffline = await this.prisma.channel.findFirst({
            where: {
              name: importChannel.channelName,
              deletedAt: null,
              streamStatus: { in: [ChannelStreamStatus.offline, ChannelStreamStatus.failed] },
            },
            include: { category: { select: { name: true } } },
          });

          if (sameNameOffline) {
            // Log the offline duplicate before soft-deleting it
            await this.logDeletedChannel(sameNameOffline, 'duplicate_replaced_by_working');
            // SOFT-DELETE only — preserves audit history and FK relations (servers, EPG, favorites).
            // A scheduled purge job can hard-delete rows whose deletedAt is older than 30 days.
            await this.prisma.channel.update({
              where: { id: sameNameOffline.id },
              data: { deletedAt: new Date(), isActive: false },
            });
          }

          // Create new channel with race-condition-safe slug generation
          const baseSlug = importChannel.channelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'channel';
          let channelCreated = false;
          let slugAttempt = 0;
          while (!channelCreated) {
            const slug = slugAttempt === 0 ? baseSlug
              : slugAttempt <= 100 ? `${baseSlug}-${slugAttempt}`
              : `${baseSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            try {
              const newChannel = await this.prisma.channel.create({
                data: {
                  name: importChannel.channelName,
                  slug,
                  normalizedName: normalized || undefined,
                  logo: importChannel.logoUrl || undefined,
                  primaryStreamUrl: importChannel.streamUrl,
                  categoryId,
                  streamType: StreamType.HLS,
                  streamStatus: ChannelStreamStatus.active,
                  isActive: true,
                  lastActiveAt: new Date(),
                },
              });
              channelId = newChannel.id;
              channelCreated = true;
            } catch (err: any) {
              if (err?.code === 'P2002' && slugAttempt < 105) {
                slugAttempt++;
              } else {
                throw err;
              }
            }
          }
        }
      }

      await this.prisma.importChannel.update({
        where: { id: importChannel.id },
        data: {
          status: ImportChannelStatus.active,
          httpStatus: result.httpStatus,
          responseTimeMs: result.responseTimeMs,
          channelId,
        },
      });
    } else {
      // Handle failed channel
      if (saveFailed) {
        // Save as inactive channel with race-condition-safe slug generation
        const baseSlug = importChannel.channelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'channel';
        let failedChannelCreated = false;
        let failedSlugAttempt = 0;
        let newChannel: any;
        while (!failedChannelCreated) {
          const slug = failedSlugAttempt === 0 ? baseSlug
            : failedSlugAttempt <= 100 ? `${baseSlug}-${failedSlugAttempt}`
            : `${baseSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          try {
            newChannel = await this.prisma.channel.create({
              data: {
                name: importChannel.channelName,
                slug,
                logo: importChannel.logoUrl || undefined,
                primaryStreamUrl: importChannel.streamUrl,
                streamType: StreamType.HLS,
                streamStatus: ChannelStreamStatus.failed,
                isActive: false,
              },
            });
            failedChannelCreated = true;
          } catch (err: any) {
            if (err?.code === 'P2002' && failedSlugAttempt < 105) {
              failedSlugAttempt++;
            } else {
              throw err;
            }
          }
        }

        await this.prisma.importChannel.update({
          where: { id: importChannel.id },
          data: {
            status: ImportChannelStatus.failed,
            failReason: result.failReason,
            httpStatus: result.httpStatus,
            responseTimeMs: result.responseTimeMs,
            channelId: newChannel.id,
          },
        });
      } else {
        await this.prisma.importChannel.update({
          where: { id: importChannel.id },
          data: {
            status: ImportChannelStatus.failed,
            failReason: result.failReason,
            httpStatus: result.httpStatus,
            responseTimeMs: result.responseTimeMs,
          },
        });
      }
    }
  }

  // ─── Import Job Management ───────────────────────────────────

  async getImportJobs() {
    const jobs = await this.prisma.importJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return jobs;
  }

  async getImportJob(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      include: {
        channels: {
          orderBy: [{ status: 'asc' }, { channelName: 'asc' }],
        },
      },
    });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  async getImportJobProgress(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        status: true,
        totalChannels: true,
        checkedChannels: true,
        activeChannels: true,
        failedChannels: true,
        skippedChannels: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
      },
    });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  async getImportJobFailedChannels(id: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Import job not found');

    const failed = await this.prisma.importChannel.findMany({
      where: { importJobId: id, status: ImportChannelStatus.failed },
      orderBy: { channelName: 'asc' },
    });
    return failed;
  }

  async cancelImportJob(id: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Import job not found');
    if (job.status === ImportJobStatus.completed || job.status === ImportJobStatus.cancelled) {
      throw new BadRequestException('Job is already completed or cancelled');
    }

    // Remove from queue
    const queues = await this.importQueue?.getJobs(['waiting', 'delayed', 'active']) ?? [];
    for (const qJob of queues) {
      const data = qJob.data as ImportJobData;
      if (data.importJobId === id) {
        await qJob.remove().catch(() => {});
        break;
      }
    }

    await this.prisma.importJob.update({
      where: { id },
      data: { status: ImportJobStatus.cancelled, completedAt: new Date() },
    });
    return { message: 'Import job cancelled' };
  }

  async deleteImportJob(id: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Import job not found');

    // If still running, cancel first
    if (![ImportJobStatus.completed, ImportJobStatus.failed, ImportJobStatus.cancelled].includes(job.status as any)) {
      await this.cancelImportJob(id);
    }

    await this.prisma.importJob.delete({ where: { id } });
    return { message: 'Import job deleted' };
  }

  // ─── Health Monitoring ───────────────────────────────────────

  async triggerHealthCheck(channelIds?: string[], offlineOnly?: boolean) {
    if (channelIds && channelIds.length > 0) {
      // Check specific channels
      if (this.healthQueue) {
        await this.healthQueue.add('check-channels', {
          channelIds,
          offlineOnly: false,
        } as HealthCheckJobData, {
          attempts: 1,
          removeOnComplete: { count: 100 },
        });
      } else {
        setImmediate(() => {
          this.processHealthCheck(channelIds).catch((err) =>
            this.logger.error(`In-process health check failed: ${err?.message}`, err?.stack),
          );
        });
      }
      return { message: `Health check queued for ${channelIds.length} channel(s)` };
    }

    const where: any = { deletedAt: null, primaryStreamUrl: { not: null } };
    if (offlineOnly) {
      where.streamStatus = { in: [ChannelStreamStatus.offline, ChannelStreamStatus.failed] };
    }

    const count = await this.prisma.channel.count({ where });

    if (count === 0) {
      return { message: 'No channels to check' };
    }

    // Process in batches of 50
    let offset = 0;
    const BATCH_SIZE = 50;
    let totalQueued = 0;

    while (offset < count) {
      const channels = await this.prisma.channel.findMany({
        where,
        select: { id: true },
        skip: offset,
        take: BATCH_SIZE,
      });

      if (channels.length === 0) break;

      if (this.healthQueue) {
        await this.healthQueue.add('check-channels', {
          channelIds: channels.map((c) => c.id),
          offlineOnly: false,
        } as HealthCheckJobData, {
          attempts: 1,
          removeOnComplete: { count: 100 },
        });
      } else {
        const ids = channels.map((c) => c.id);
        setImmediate(() => {
          this.processHealthCheck(ids).catch((err) =>
            this.logger.error(`In-process health check batch failed: ${err?.message}`, err?.stack),
          );
        });
      }

      totalQueued += channels.length;
      offset += BATCH_SIZE;
    }

    return { message: `Health check queued for ${totalQueued} channels in batches of ${BATCH_SIZE}` };
  }

  async processHealthCheck(channelIds: string[]) {
    this.logger.log(`Health check started for ${channelIds.length} channels`);

    // ── 1. Bulk-fetch all channels in ONE DB round-trip ──────────────────────
    const channels = await this.prisma.channel.findMany({
      where: { id: { in: channelIds } },
      select: {
        id: true,
        primaryStreamUrl: true,
        streamStatus: true,
        servers: {
          where: { healthCheckEnabled: true, deletedAt: null, enabled: true },
          orderBy: { priority: 'asc' },
          take: 1,
          select: { cookie: true, userAgent: true, referer: true, origin: true },
        },
      },
    });

    const withUrl = channels.filter((ch) => !!ch.primaryStreamUrl);
    if (withUrl.length === 0) {
      this.logger.log('Health check: no channels with a stream URL — skipped');
      return;
    }

    // ── 2. Bulk-mark as 'checking' in ONE updateMany ──────────────────────────
    await this.prisma.channel.updateMany({
      where: { id: { in: withUrl.map((c) => c.id) } },
      data: { streamStatus: ChannelStreamStatus.checking },
    });

    // ── 3. Validate streams concurrently (max 5 at a time) ───────────────────
    const CONCURRENCY = 5;
    const results: Array<{
      id: string;
      ok: boolean;
      failReason?: string;
      responseTimeMs?: number;
    }> = [];

    for (let i = 0; i < withUrl.length; i += CONCURRENCY) {
      const batch = withUrl.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (ch) => {
          try {
            const result = await this.streamValidation.validateWithHeaders(
              ch.primaryStreamUrl!,
              ch.servers?.[0] ?? undefined,
            );
            return {
              id: ch.id,
              ok: result.success,
              failReason: result.failReason,
              responseTimeMs: result.responseTimeMs,
            };
          } catch {
            return { id: ch.id, ok: false, failReason: 'validation_error' };
          }
        }),
      );
      results.push(...batchResults);
    }

    // ── 4. Bulk-write results in a single $transaction ────────────────────────
    const now = new Date();
    await this.prisma.$transaction(
      results.map((r) =>
        this.prisma.channel.update({
          where: { id: r.id },
          data: {
            streamStatus: r.ok ? ChannelStreamStatus.active : ChannelStreamStatus.offline,
            isActive: r.ok,
            ...(r.ok && { lastActiveAt: now }),
          },
        }),
      ),
    );

    for (const r of results) {
      const label = r.ok ? 'ACTIVE' : `OFFLINE (${r.failReason ?? 'unknown'})`;
      this.logger.debug(
        `Channel ${r.id}: ${label}${r.responseTimeMs != null ? ` (${r.responseTimeMs}ms)` : ''}`,
      );
    }

    this.logger.log(`Health check completed for ${channelIds.length} channels`);
  }

  // ─── Dashboard Stats ─────────────────────────────────────────

  async getChannelHealthStats() {
    const [total, active, offline, failed, pending, checking, lastScanned] = await Promise.all([
      this.prisma.channel.count({ where: { deletedAt: null, primaryStreamUrl: { not: null } } }),
      this.prisma.channel.count({ where: { deletedAt: null, streamStatus: ChannelStreamStatus.active, primaryStreamUrl: { not: null } } }),
      this.prisma.channel.count({ where: { deletedAt: null, streamStatus: ChannelStreamStatus.offline, primaryStreamUrl: { not: null } } }),
      this.prisma.channel.count({ where: { deletedAt: null, streamStatus: ChannelStreamStatus.failed, primaryStreamUrl: { not: null } } }),
      this.prisma.channel.count({ where: { deletedAt: null, streamStatus: ChannelStreamStatus.pending, primaryStreamUrl: { not: null } } }),
      this.prisma.channel.count({ where: { deletedAt: null, streamStatus: ChannelStreamStatus.checking, primaryStreamUrl: { not: null } } }),
      // Last scan time = most recently health-checked channel (status active/offline/failed = set by health check)
      this.prisma.channel.findFirst({
        where: {
          deletedAt: null,
          primaryStreamUrl: { not: null },
          streamStatus: { in: [ChannelStreamStatus.active, ChannelStreamStatus.offline, ChannelStreamStatus.failed] },
        },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    return {
      total,
      active,
      offline,
      failed,
      pending,
      checking,
      lastScanTime: lastScanned?.updatedAt ?? null,
    };
  }

  async getImportHistory() {
    const jobs = await this.prisma.importJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return jobs;
  }

  async getFailedChannels(query: { page?: number; limit?: number; search?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      streamStatus: { in: [ChannelStreamStatus.failed, ChannelStreamStatus.offline] },
    };
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [channels, total] = await Promise.all([
      this.prisma.channel.findMany({
        where, skip, take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.channel.count({ where }),
    ]);

    // Attach last-24h user playback stats to each channel
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const channelIds = channels.map(c => c.id);
    const events = channelIds.length > 0
      ? await this.prisma.playbackEvent.findMany({
          where: { channelId: { in: channelIds }, createdAt: { gte: since } },
          select: { channelId: true, success: true },
        })
      : [];

    const eventsByChannel = new Map<string, { success: number; fail: number }>();
    for (const ev of events) {
      const cur = eventsByChannel.get(ev.channelId) ?? { success: 0, fail: 0 };
      if (ev.success) cur.success += 1; else cur.fail += 1;
      eventsByChannel.set(ev.channelId, cur);
    }

    const data = channels.map(ch => {
      const stats = eventsByChannel.get(ch.id);
      const total24h = stats ? stats.success + stats.fail : 0;
      const successRate24h = total24h > 0 ? Math.round((stats!.success / total24h) * 100) : null;
      return {
        ...ch,
        userPlayback: {
          total: total24h,
          successRate: successRate24h,
          health: successRate24h === null ? 'no_data' : successRate24h >= 80 ? 'healthy' : successRate24h >= 50 ? 'unstable' : 'offline',
        },
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async recheckSingleChannel(channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, primaryStreamUrl: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    if (!channel.primaryStreamUrl) throw new BadRequestException('Channel has no stream URL');

    await this.prisma.channel.update({
      where: { id: channelId },
      data: { streamStatus: ChannelStreamStatus.checking },
    });

    if (this.healthQueue) {
      await this.healthQueue.add('check-channels', {
        channelIds: [channelId],
      } as HealthCheckJobData);
    } else {
      setImmediate(() => {
        this.processHealthCheck([channelId]).catch((err) =>
          this.logger.error(`In-process recheck for channel ${channelId} failed: ${err?.message}`, err?.stack),
        );
      });
    }

    return { message: 'Channel recheck queued' };
  }

  // ─── Deleted Channel Log ─────────────────────────────────────

  async logDeletedChannel(
    channel: { name: string; primaryStreamUrl?: string | null; logo?: string | null; category?: { name: string } | null },
    reason: string,
  ) {
    try {
      await this.prisma.deletedChannelLog.create({
        data: {
          channelName: channel.name,
          streamUrl: channel.primaryStreamUrl ?? null,
          logo: channel.logo ?? null,
          categoryName: channel.category?.name ?? null,
          deleteReason: reason,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to log deleted channel: ${err?.message}`);
    }
  }

  async getDeletedChannelLogs(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.deletedChannelLog.findMany({
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.deletedChannelLog.count(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async clearDeletedChannelLogs() {
    const { count } = await this.prisma.deletedChannelLog.deleteMany({});
    return { message: `Cleared ${count} deleted channel log entries` };
  }

  // ─── Auto Cleanup (called by scheduler) ──────────────────────

  async cleanupInactiveChannels() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find channels that have NEVER been active (lastActiveAt is null) AND were created > 7 days ago
    // OR channels whose lastActiveAt is older than 7 days
    const inactiveChannels = await this.prisma.channel.findMany({
      where: {
        deletedAt: null,
        streamStatus: { in: [ChannelStreamStatus.offline, ChannelStreamStatus.failed] },
        OR: [
          { lastActiveAt: null, createdAt: { lt: sevenDaysAgo } },
          { lastActiveAt: { lt: sevenDaysAgo } },
        ],
      },
      include: { category: { select: { name: true } } },
      take: 500,
    });

    if (inactiveChannels.length === 0) {
      this.logger.log('Auto-cleanup: no inactive channels to delete');
      return { deleted: 0 };
    }

    this.logger.log(`Auto-cleanup: soft-deleting ${inactiveChannels.length} channels inactive for 7+ days`);

    for (const channel of inactiveChannels) {
      await this.logDeletedChannel(channel, 'inactive_7_days');
      // SOFT-DELETE — preserves audit history, EPG, favorites, and FK relations.
      // A 30-day grace period should be observed by a separate purge job before
      // hard-deleting these rows (gives ops a chance to restore channels that were
      // offline due to a temporary upstream issue, not a real deletion).
      await this.prisma.channel.update({
        where: { id: channel.id },
        data: { deletedAt: new Date(), isActive: false },
      });
    }

    this.logger.log(`Auto-cleanup: soft-deleted ${inactiveChannels.length} channels`);
    return { deleted: inactiveChannels.length };
  }
}