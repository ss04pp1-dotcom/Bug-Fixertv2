import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [HealthController],
})
export class HealthModule {}
