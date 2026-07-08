import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRetentionService } from './analytics-retention.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRetentionService],
})
export class AnalyticsModule {}
