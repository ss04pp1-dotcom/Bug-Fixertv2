import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
