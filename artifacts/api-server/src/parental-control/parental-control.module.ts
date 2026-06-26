import { Module } from '@nestjs/common';
import { ParentalControlController } from './parental-control.controller';
import { ParentalControlService } from './parental-control.service';

@Module({ controllers: [ParentalControlController], providers: [ParentalControlService], exports: [ParentalControlService] })
export class ParentalControlModule {}
