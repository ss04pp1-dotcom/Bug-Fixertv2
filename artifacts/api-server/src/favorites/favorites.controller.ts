import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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

  @Post() @ApiOperation({ summary: 'Add to favorites' })
  add(@CurrentUser('id') userId: string, @Body() body: { channelId?: string; movieId?: string; seriesId?: string }) {
    return this.favoritesService.add(userId, body);
  }

  @Delete() @ApiOperation({ summary: 'Remove from favorites' })
  remove(@CurrentUser('id') userId: string, @Body() body: { channelId?: string; movieId?: string; seriesId?: string }) {
    return this.favoritesService.remove(userId, body);
  }

  @Get('check/:type/:id') @ApiOperation({ summary: 'Check if item is in favorites' })
  check(@CurrentUser('id') userId: string, @Param('type') type: string, @Param('id') id: string) {
    return this.favoritesService.check(userId, type, id);
  }
}
