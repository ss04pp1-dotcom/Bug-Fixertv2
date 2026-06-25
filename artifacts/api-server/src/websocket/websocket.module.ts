import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StreamProGateway } from './websocket.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PresenceController],
  providers: [StreamProGateway, WsJwtGuard, PresenceService],
  exports: [StreamProGateway, WsJwtGuard, PresenceService],
})
export class WebsocketModule {}
