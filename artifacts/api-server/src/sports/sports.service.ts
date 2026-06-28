import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, MatchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { AddCommentaryDto } from './dto/add-commentary.dto';

@Injectable()
export class SportsService {
  constructor(private prisma: PrismaService) {}

  // ──────────────── Sport Types ────────────────

  async findAllSports(query: { limit?: number; search?: string }) {
    const where: Prisma.SportWhereInput = {};
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    // A-056: clamp limit to 500 — there are ~200 recognized sport types globally,
    // but a misconfigured client could ask for millions.
    const safeLimit = Math.min(Number(query.limit) || 200, 500);
    const data = await this.prisma.sport.findMany({
      where,
      take: safeLimit,
      orderBy: { name: 'asc' },
    });
    return { data };
  }

  // ──────────────── Matches ────────────────

  async findAllMatches(query: PaginationDto & { sportId?: string; status?: string; tournamentId?: string }) {
    const { skip, limit = 20, page = 1, search } = query;
    const where: Prisma.MatchWhereInput = { deletedAt: null };

    if (query.sportId) where.sportId = query.sportId;
    if (query.tournamentId) where.tournamentId = query.tournamentId;
    if (query.status && Object.values(MatchStatus).includes(query.status as MatchStatus)) {
      where.status = query.status as MatchStatus;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { teamA: { name: { contains: search, mode: 'insensitive' } } },
        { teamB: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          sport: { select: { id: true, name: true, slug: true } },
          tournament: { select: { id: true, name: true, slug: true, logo: true } },
          teamA: { select: { id: true, name: true, shortName: true, abbr: true, logo: true } },
          teamB: { select: { id: true, name: true, shortName: true, abbr: true, logo: true } },
        },
      }),
      this.prisma.match.count({ where }),
    ]);
    return { data, meta: paginate(total, page, limit) };
  }

  async findLiveMatches() {
    return this.prisma.match.findMany({
      where: { status: MatchStatus.live, deletedAt: null },
      orderBy: { scheduledAt: 'desc' },
      include: {
        sport: { select: { id: true, name: true, slug: true } },
        tournament: { select: { id: true, name: true, slug: true, logo: true } },
        teamA: { select: { id: true, name: true, shortName: true, abbr: true, logo: true } },
        teamB: { select: { id: true, name: true, shortName: true, abbr: true, logo: true } },
      },
    });
  }

  async findUpcomingMatches(sportId?: string, limit: number = 20) {
    const where: Prisma.MatchWhereInput = {
      status: { in: [MatchStatus.upcoming] },
      scheduledAt: { gte: new Date() },
      deletedAt: null,
    };
    if (sportId) where.sportId = sportId;

    return this.prisma.match.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      include: {
        sport: { select: { id: true, name: true, slug: true } },
        tournament: { select: { id: true, name: true, slug: true, logo: true } },
        teamA: { select: { id: true, name: true, shortName: true, abbr: true, logo: true } },
        teamB: { select: { id: true, name: true, shortName: true, abbr: true, logo: true } },
      },
    });
  }

  async findOneMatch(id: string) {
    const match = await this.prisma.match.findFirst({
      where: { id, deletedAt: null },
      include: {
        sport: true,
        tournament: true,
        teamA: true,
        teamB: true,
        winner: { select: { id: true, name: true, shortName: true, abbr: true, logo: true } },
        commentary: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  async createMatch(dto: CreateMatchDto) {
    const [sport, tournament, teamA, teamB] = await Promise.all([
      this.prisma.sport.findUnique({ where: { id: dto.sportId } }),
      this.prisma.tournament.findUnique({ where: { id: dto.tournamentId } }),
      this.prisma.sportTeam.findUnique({ where: { id: dto.teamAId } }),
      this.prisma.sportTeam.findUnique({ where: { id: dto.teamBId } }),
    ]);

    if (!sport) throw new NotFoundException('Sport not found');
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (!teamA) throw new NotFoundException('Team A not found');
    if (!teamB) throw new NotFoundException('Team B not found');

    return this.prisma.match.create({
      data: {
        title: dto.title,
        sportId: dto.sportId,
        tournamentId: dto.tournamentId,
        teamAId: dto.teamAId,
        teamBId: dto.teamBId,
        scheduledAt: new Date(dto.scheduledAt),
        venue: dto.venue,
        streamUrl: dto.streamUrl,
        liveUrl: dto.liveUrl,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateMatch(id: string, dto: Partial<CreateMatchDto>) {
    await this.findOneMatch(id);

    const data: Prisma.MatchUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.sportId !== undefined) data.sport = { connect: { id: dto.sportId } };
    if (dto.tournamentId !== undefined) data.tournament = { connect: { id: dto.tournamentId } };
    if (dto.teamAId !== undefined) data.teamA = { connect: { id: dto.teamAId } };
    if (dto.teamBId !== undefined) data.teamB = { connect: { id: dto.teamBId } };
    if (dto.scheduledAt !== undefined) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.venue !== undefined) data.venue = dto.venue;
    if (dto.streamUrl !== undefined) data.streamUrl = dto.streamUrl;
    if (dto.liveUrl !== undefined) data.liveUrl = dto.liveUrl;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.match.update({ where: { id }, data });
  }

  async removeMatch(id: string) {
    await this.findOneMatch(id);
    await this.prisma.match.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Match deleted' };
  }

  // ──────────────── Commentary ────────────────

  async getCommentary(matchId: string, query: PaginationDto) {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, deletedAt: null },
    });
    if (!match) throw new NotFoundException('Match not found');

    const { skip, limit = 20, page = 1 } = query;
    const where: Prisma.MatchCommentaryWhereInput = { matchId };

    const [data, total] = await Promise.all([
      this.prisma.matchCommentary.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.matchCommentary.count({ where }),
    ]);
    return { data, meta: paginate(total, page, limit) };
  }

  async addCommentary(matchId: string, dto: AddCommentaryDto, userId: string) {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, deletedAt: null },
    });
    if (!match) throw new NotFoundException('Match not found');

    return this.prisma.matchCommentary.create({
      data: {
        matchId,
        eventType: dto.eventType,
        text: dto.text,
        score: dto.score,
        over: dto.over,
        minute: dto.minute,
      },
    });
  }

  // ──────────────── Match Alerts ────────────────

  async getMyAlerts(userId: string) {
    return this.prisma.matchAlert.findMany({
      where: { userId, isEnabled: true },
      include: {
        match: {
          include: {
            teamA: { select: { id: true, name: true, shortName: true, logo: true } },
            teamB: { select: { id: true, name: true, shortName: true, logo: true } },
            tournament: { select: { id: true, name: true, logo: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleAlert(userId: string, matchId: string) {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, deletedAt: null },
    });
    if (!match) throw new NotFoundException('Match not found');

    const existing = await this.prisma.matchAlert.findFirst({
      where: { userId, matchId },
    });

    if (existing) {
      return this.prisma.matchAlert.update({
        where: { id: existing.id },
        data: { isEnabled: !existing.isEnabled },
      });
    }

    return this.prisma.matchAlert.create({
      data: { userId, matchId, isEnabled: true },
    });
  }

  // ──────────────── Teams ────────────────

  async findAllTeams(query: { sportId?: string; tournamentId?: string; search?: string }) {
    const where: Prisma.SportTeamWhereInput = { deletedAt: null };

    if (query.sportId) where.tournament = { sportId: query.sportId };
    if (query.tournamentId) where.tournamentId = query.tournamentId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { shortName: { contains: query.search, mode: 'insensitive' } },
        { abbr: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const data = await this.prisma.sportTeam.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        tournament: { select: { id: true, name: true, slug: true } },
      },
    });
    return { data };
  }

  async createTeam(dto: CreateTeamDto) {
    if (dto.tournamentId) {
      const tournament = await this.prisma.tournament.findUnique({ where: { id: dto.tournamentId } });
      if (!tournament) throw new NotFoundException('Tournament not found');
    }

    return this.prisma.sportTeam.create({
      data: {
        name: dto.name, slug: dto.slug, shortName: dto.shortName,
        abbr: dto.abbr, logo: dto.logo, country: dto.country,
        primaryColor: dto.primaryColor, secondaryColor: dto.secondaryColor,
        tournamentId: dto.tournamentId, isActive: dto.isActive,
      },
    });
  }

  async updateTeam(id: string, dto: Partial<CreateTeamDto>) {
    await this.findOneTeam(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.shortName !== undefined) data.shortName = dto.shortName;
    if (dto.abbr !== undefined) data.abbr = dto.abbr;
    if (dto.logo !== undefined) data.logo = dto.logo;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.primaryColor !== undefined) data.primaryColor = dto.primaryColor;
    if (dto.secondaryColor !== undefined) data.secondaryColor = dto.secondaryColor;
    if (dto.tournamentId !== undefined) data.tournamentId = dto.tournamentId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.sportTeam.update({ where: { id }, data });
  }

  async removeTeam(id: string) {
    await this.findOneTeam(id);
    await this.prisma.sportTeam.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Team deleted' };
  }

  private async findOneTeam(id: string) {
    const team = await this.prisma.sportTeam.findFirst({ where: { id, deletedAt: null } });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  // ──────────────── Tournaments ────────────────

  async findAllTournaments(query: { sportId?: string; search?: string }) {
    const where: Prisma.TournamentWhereInput = { deletedAt: null };

    if (query.sportId) where.sportId = query.sportId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { country: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const data = await this.prisma.tournament.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        sport: { select: { id: true, name: true, slug: true } },
      },
    });
    return { data };
  }

  async createTournament(dto: CreateTournamentDto) {
    const sport = await this.prisma.sport.findUnique({ where: { id: dto.sportId } });
    if (!sport) throw new NotFoundException('Sport not found');

    return this.prisma.tournament.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        logo: dto.logo,
        banner: dto.banner,
        country: dto.country,
        sportId: dto.sportId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateTournament(id: string, dto: Partial<CreateTournamentDto>) {
    await this.findOneTournament(id);

    const data: Prisma.TournamentUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.logo !== undefined) data.logo = dto.logo;
    if (dto.banner !== undefined) data.banner = dto.banner;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.sportId !== undefined) data.sport = { connect: { id: dto.sportId } };
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.tournament.update({ where: { id }, data });
  }

  async removeTournament(id: string) {
    await this.findOneTournament(id);
    await this.prisma.tournament.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Tournament deleted' };
  }

  private async findOneTournament(id: string) {
    const tournament = await this.prisma.tournament.findFirst({ where: { id, deletedAt: null } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return tournament;
  }

  // ──────────────── User Favorite Teams ────────────────

  async getMyTeams(userId: string) {
    return this.prisma.userFavoriteTeam.findMany({
      where: { userId },
      include: {
        team: { select: { id: true, name: true, shortName: true, abbr: true, logo: true, country: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addTeamToFavorites(userId: string, teamId: string) {
    const team = await this.prisma.sportTeam.findFirst({ where: { id: teamId, deletedAt: null } });
    if (!team) throw new NotFoundException('Team not found');

    const existing = await this.prisma.userFavoriteTeam.findFirst({
      where: { userId, teamId },
    });
    if (existing) return existing;

    return this.prisma.userFavoriteTeam.create({ data: { userId, teamId } });
  }

  async removeTeamFromFavorites(userId: string, teamId: string) {
    const fav = await this.prisma.userFavoriteTeam.findFirst({
      where: { userId, teamId },
    });
    if (!fav) return { message: 'Team not in favorites' };
    await this.prisma.userFavoriteTeam.delete({ where: { id: fav.id } });
    return { message: 'Removed from favorites' };
  }
}