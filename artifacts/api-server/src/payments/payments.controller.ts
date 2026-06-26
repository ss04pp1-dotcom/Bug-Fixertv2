import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, Headers, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, CreateGatewayDto, WebhookDto, RefundDto, UpsertGatewayDto } from './dto/payments.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  @Get() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get all payments' })
  findAll(@Query() query: PaginationDto) { return this.svc.findAll(query); }

  @Get('stats') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Payment stats' })
  getStats() { return this.svc.getStats(); }

  @Get('my') @ApiOperation({ summary: 'My payment history' })
  findMyPayments(@CurrentUser('id') userId: string, @Query() query: PaginationDto) {
    return this.svc.findByUser(userId, query);
  }

  @Get('gateways') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get payment gateways' })
  getGateways() { return this.svc.getGateways(); }

  @Post('gateways') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Create payment gateway' })
  createGateway(@Body() dto: CreateGatewayDto) { return this.svc.createGateway(dto); }

  @Put('gateways/:id') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Update payment gateway' })
  updateGateway(@Param('id') id: string, @Body() dto: Partial<CreateGatewayDto>) {
    return this.svc.updateGateway(id, dto);
  }

  @Post('gateways/upsert') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Upsert gateway by slug' })
  upsertGateway(@Body() body: UpsertGatewayDto) {
    const { slug, ...dto } = body;
    return this.svc.upsertBySlug(slug, dto);
  }

  @Post('gateways/:slug/test') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Test gateway credentials (validates keys are non-empty)' })
  testGateway(
    @Param('slug') slug: string,
    @Body() body: { publicKey?: string; secretKey?: string; config?: Record<string, unknown> },
  ) {
    const hasKey = !!(body.secretKey || body.publicKey || (body.config && Object.keys(body.config).length > 0));
    if (!hasKey) throw new BadRequestException('No credentials provided to test');
    return { success: true, slug, message: 'Credentials accepted — connection will be verified on first transaction' };
  }

  @Delete('gateways/:id') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete payment gateway' })
  deleteGateway(@Param('id') id: string) { return this.svc.deleteGateway(id); }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Payment gateway webhook (public)' })
  webhook(@Body() payload: WebhookDto, @Headers('x-gateway-signature') signature: string, @Req() req: Request) {
    return this.svc.handleWebhook(payload, signature, req);
  }

  @Post() @ApiOperation({ summary: 'Create payment record' })
  create(@Body() dto: CreatePaymentDto, @CurrentUser('id') userId: string) {
    return this.svc.create({ ...dto, userId });
  }

  @Post(':id/verify') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Verify payment (admin)' })
  verify(@Param('id') id: string) { return this.svc.verify(id); }

  @Post(':id/refund') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Refund payment' })
  refund(@Param('id') id: string, @Body() dto: RefundDto) { return this.svc.refund(id, dto); }

  @Get(':id/invoice') @ApiOperation({ summary: 'Get payment invoice' })
  getInvoice(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.getInvoice(id, userId);
  }
}
