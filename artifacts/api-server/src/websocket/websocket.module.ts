import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SolTvGateway } from './websocket.gateway';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PresenceController],
  providers: [SolTvGateway, PresenceService],
  exports: [SolTvGateway, PresenceService],
})
export class WebsocketModule {}
