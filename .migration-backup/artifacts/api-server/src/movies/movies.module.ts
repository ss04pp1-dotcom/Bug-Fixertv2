import { Module } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { GeoBlockModule } from '../geo-block/geo-block.module';
import { ParentalControlModule } from '../parental-control/parental-control.module';

@Module({
  imports: [GeoBlockModule, ParentalControlModule],
  controllers: [MoviesController],
  providers: [MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
