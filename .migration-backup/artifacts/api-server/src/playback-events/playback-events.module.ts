import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlaybackEventsController } from './playback-events.controller';
import { PlaybackEventsService } from './playback-events.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlaybackEventsController],
  providers: [PlaybackEventsService],
  exports: [PlaybackEventsService],
})
export class PlaybackEventsModule {}
