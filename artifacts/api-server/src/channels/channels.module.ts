import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { GeoBlockModule } from '../geo-block/geo-block.module';
import { M3uImportModule } from '../m3u-import/m3u-import.module';

@Module({
  imports: [GeoBlockModule, M3uImportModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
