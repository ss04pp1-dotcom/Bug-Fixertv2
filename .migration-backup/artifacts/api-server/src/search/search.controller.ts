import { Controller, Get, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Search')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Global search' })
  search(@Query('q') q: string, @CurrentUser('id') userId?: string) {
    return this.searchService.globalSearch(q, userId);
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Trending searches' })
  getTrending() { return this.searchService.getTrendingSearches(); }

  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My search history' })
  getHistory(@CurrentUser('id') userId: string) {
    return this.searchService.getSearchHistory(userId);
  }

  @Delete('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear search history' })
  clearHistory(@CurrentUser('id') userId: string) {
    return this.searchService.clearSearchHistory(userId);
  }
}
