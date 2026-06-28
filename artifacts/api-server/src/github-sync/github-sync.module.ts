import { Module } from '@nestjs/common';
import { GitHubSyncService } from './github-sync.service';
import { GitHubSyncScheduler } from './github-sync.scheduler';
import { KeepAliveScheduler } from './keep-alive.scheduler';
import { M3uParser } from './parsers/m3u.parser';
import { JsonParser } from './parsers/json.parser';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GitHubSyncService, GitHubSyncScheduler, KeepAliveScheduler, M3uParser, JsonParser],
  exports: [GitHubSyncService],
})
export class GitHubSyncModule {}
