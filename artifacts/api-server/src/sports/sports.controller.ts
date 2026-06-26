import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SportsService } from './sports.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { AddCommentaryDto } from './dto/add-commentary.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Sports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'sports', version: '1' })
export class SportsController {
  constructor(private sportsService: SportsService) {}

  // ──────────────── Sport Types ────────────────

  @Public()
  @Get('sports')
  @ApiOperation({ summary: 'List sport types (football, cricket, etc.)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  findAllSportTypes(
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.sportsService.findAllSports({ limit: limit ? Number(limit) : 200, search });
  }

  // ──────────────── Matches ────────────────

  @Public()
  @Get()
  @ApiOperation({ summary: 'List sports matches with pagination' })
  @ApiQuery({ name: 'sportId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['upcoming', 'live', 'completed'] })
  @ApiQuery({ name: 'tournamentId', required: false })
  findAll(@Query() query: PaginationDto) {
    return this.sportsService.findAllMatches(query);
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Get all live matches' })
  findLive() {
    return this.sportsService.findLiveMatches();
  }

  @Public()
  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming matches' })
  @ApiQuery({ name: 'sportId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findUpcoming(@Query('sportId') sportId?: string, @Query('limit') limit?: number) {
    return this.sportsService.findUpcomingMatches(sportId, limit ? Number(limit) : 20);
  }

  @Get('matches/my-alerts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user match alerts' })
  getMyAlerts(@CurrentUser('id') userId: string) {
    return this.sportsService.getMyAlerts(userId);
  }

  @Public()
  @Get('teams')
  @ApiOperation({ summary: 'List teams' })
  @ApiQuery({ name: 'sportId', required: false })
  @ApiQuery({ name: 'tournamentId', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAllTeams(
    @Query('sportId') sportId?: string,
    @Query('tournamentId') tournamentId?: string,
    @Query('search') search?: string,
  ) {
    return this.sportsService.findAllTeams({ sportId, tournamentId, search });
  }

  @Post('teams')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Create team' })
  createTeam(@Body() dto: CreateTeamDto) {
    return this.sportsService.createTeam(dto);
  }

  @Put('teams/:id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Update team' })
  updateTeam(@Param('id') id: string, @Body() dto: Partial<CreateTeamDto>) {
    return this.sportsService.updateTeam(id, dto);
  }

  @Delete('teams/:id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Delete team' })
  removeTeam(@Param('id') id: string) {
    return this.sportsService.removeTeam(id);
  }

  @Public()
  @Get('tournaments')
  @ApiOperation({ summary: 'List tournaments' })
  @ApiQuery({ name: 'sportId', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAllTournaments(@Query('sportId') sportId?: string, @Query('search') search?: string) {
    return this.sportsService.findAllTournaments({ sportId, search });
  }

  @Post('tournaments')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Create tournament' })
  createTournament(@Body() dto: CreateTournamentDto) {
    return this.sportsService.createTournament(dto);
  }

  @Put('tournaments/:id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Update tournament' })
  updateTournament(@Param('id') id: string, @Body() dto: Partial<CreateTournamentDto>) {
    return this.sportsService.updateTournament(id, dto);
  }

  @Delete('tournaments/:id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Delete tournament' })
  removeTournament(@Param('id') id: string) {
    return this.sportsService.removeTournament(id);
  }

  @Get('my-teams')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user favorite teams' })
  getMyTeams(@CurrentUser('id') userId: string) {
    return this.sportsService.getMyTeams(userId);
  }

  @Public()
  @Get('sports')
  @ApiOperation({ summary: 'List all sport types/categories' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  findAllSports(
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.sportsService.findAllSports({ limit: limit ? Number(limit) : 200, search });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get match by ID' })
  findOne(@Param('id') id: string) {
    return this.sportsService.findOneMatch(id);
  }

  @Public()
  @Get(':id/commentary')
  @ApiOperation({ summary: 'Get match commentary' })
  getCommentary(@Param('id') id: string, @Query() query: PaginationDto) {
    return this.sportsService.getCommentary(id, query);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Create match' })
  create(@Body() dto: CreateMatchDto) {
    return this.sportsService.createMatch(dto);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Update match' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateMatchDto>) {
    return this.sportsService.updateMatch(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Delete match' })
  remove(@Param('id') id: string) {
    return this.sportsService.removeMatch(id);
  }

  @Post(':id/commentary')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Add commentary event' })
  addCommentary(
    @Param('id') id: string,
    @Body() dto: AddCommentaryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.sportsService.addCommentary(id, dto, userId);
  }

  @Post('matches/:matchId/alert')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle match alert on/off' })
  toggleAlert(@CurrentUser('id') userId: string, @Param('matchId') matchId: string) {
    return this.sportsService.toggleAlert(userId, matchId);
  }

  @Post('my-teams/:teamId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add team to favorites' })
  addTeamToFavorites(@CurrentUser('id') userId: string, @Param('teamId') teamId: string) {
    return this.sportsService.addTeamToFavorites(userId, teamId);
  }

  @Delete('my-teams/:teamId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove team from favorites' })
  removeTeamFromFavorites(@CurrentUser('id') userId: string, @Param('teamId') teamId: string) {
    return this.sportsService.removeTeamFromFavorites(userId, teamId);
  }
}