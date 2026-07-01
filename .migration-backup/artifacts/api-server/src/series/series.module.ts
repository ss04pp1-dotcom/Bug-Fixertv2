import { Module } from '@nestjs/common';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';
import { GeoBlockModule } from '../geo-block/geo-block.module';
import { ParentalControlModule } from '../parental-control/parental-control.module';

@Module({
  imports: [GeoBlockModule, ParentalControlModule],
  controllers: [SeriesController],
  providers: [SeriesService],
  exports: [SeriesService],
})
export class SeriesModule {}
