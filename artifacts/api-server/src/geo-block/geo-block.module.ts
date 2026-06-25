import { Module } from '@nestjs/common';
import { GeoBlockController } from './geo-block.controller';
import { GeoBlockService } from './geo-block.service';

@Module({ controllers: [GeoBlockController], providers: [GeoBlockService], exports: [GeoBlockService] })
export class GeoBlockModule {}
