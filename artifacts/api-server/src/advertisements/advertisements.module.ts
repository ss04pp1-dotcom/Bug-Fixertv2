import { Module } from '@nestjs/common';
import { AdvertisementsController } from './advertisements.controller';
import { AdsConfigController } from './ads-config.controller';
import { AdvertisementsService } from './advertisements.service';

@Module({
  controllers: [AdvertisementsController, AdsConfigController],
  providers: [AdvertisementsService],
  exports: [AdvertisementsService],
})
export class AdvertisementsModule {}
