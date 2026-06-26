import { Module } from '@nestjs/common';
import { EpgController } from './epg.controller';
import { EpgService } from './epg.service';

@Module({ controllers: [EpgController], providers: [EpgService], exports: [EpgService] })
export class EpgModule {}
