import { Module } from '@nestjs/common';
import { GitHubSourcesController } from './github-sources.controller';
import { GitHubSourcesService } from './github-sources.service';
import { GitHubSyncModule } from '../github-sync/github-sync.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, GitHubSyncModule],
  controllers: [GitHubSourcesController],
  providers: [GitHubSourcesService],
  exports: [GitHubSourcesService],
})
export class GitHubSourcesModule {}
