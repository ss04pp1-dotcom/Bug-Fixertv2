import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ModifyFavoriteDto } from './dto/modify-favorite.dto';

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'favorites', version: '1' })
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Get() @ApiOperation({ summary: 'Get my favorites' })
  getMyFavorites(@CurrentUser('id') userId: string) {
    return this.favoritesService.getMyFavorites(userId);
  }

  // A-054: use validated DTO instead of inline anonymous type so ValidationPipe
  // whitelist rejects extra/injected fields and UUIDs are enforced.
  @Post() @ApiOperation({ summary: 'Add to favorites' })
  add(@CurrentUser('id') userId: string, @Body() dto: ModifyFavoriteDto) {
    return this.favoritesService.add(userId, dto);
  }

  @Delete() @ApiOperation({ summary: 'Remove from favorites' })
  remove(@CurrentUser('id') userId: string, @Body() dto: ModifyFavoriteDto) {
    return this.favoritesService.remove(userId, dto);
  }

  @Get('check/:type/:id') @ApiOperation({ summary: 'Check if item is in favorites' })
  check(@CurrentUser('id') userId: string, @Param('type') type: string, @Param('id') id: string) {
    return this.favoritesService.check(userId, type, id);
  }
}
