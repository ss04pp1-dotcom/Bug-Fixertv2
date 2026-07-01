import { Module } from '@nestjs/common';
import { ForceUpdateController } from './force-update.controller';
import { ForceUpdateService } from './force-update.service';

@Module({ controllers: [ForceUpdateController], providers: [ForceUpdateService], exports: [ForceUpdateService] })
export class ForceUpdateModule {}
