import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { CreatePlanDto, CreateSubscriptionDto, VerifySubscriptionDto, CreateCouponDto, ApplyCouponDto } from './dto/create-plan.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private svc: SubscriptionsService) {}

  @Public() @Get('plans') @ApiOperation({ summary: 'Get all subscription plans' })
  getPlans(@Query() query: PaginationDto) { return this.svc.getPlans(query); }

  @Public() @Get('plans/:id') @ApiOperation({ summary: 'Get plan by ID or slug' })
  getPlan(@Param('id') id: string) { return this.svc.getPlan(id); }

  @Post('plans') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Create plan' })
  createPlan(@Body() dto: CreatePlanDto) { return this.svc.createPlan(dto); }

  @Put('plans/:id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Update plan' })
  updatePlan(@Param('id') id: string, @Body() dto: Partial<CreatePlanDto>) { return this.svc.updatePlan(id, dto); }

  @Delete('plans/:id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete plan' })
  deletePlan(@Param('id') id: string) { return this.svc.deletePlan(id); }

  @Post('subscribe') @ApiBearerAuth() @ApiOperation({ summary: 'Subscribe to a plan' })
  subscribe(@Body() dto: CreateSubscriptionDto, @CurrentUser('id') userId: string) {
    return this.svc.subscribe({ ...dto, userId });
  }

  @Roles('super_admin', 'admin') @Post('verify') @ApiBearerAuth() @ApiOperation({ summary: 'Verify payment and activate subscription' })
  verify(@Body() dto: VerifySubscriptionDto, @CurrentUser('id') userId: string) { return this.svc.verifyAndActivate(dto, userId); }

  @Get('my') @ApiBearerAuth() @ApiOperation({ summary: 'Get my subscription' })
  getMySubscription(@CurrentUser('id') userId: string) { return this.svc.getUserSubscription(userId); }

  @Get('me') @ApiBearerAuth() @ApiOperation({ summary: 'Get my subscription (alias for /my)' })
  getMySubscriptionAlias(@CurrentUser('id') userId: string) { return this.svc.getUserSubscription(userId); }

  @Post('cancel') @ApiBearerAuth() @ApiOperation({ summary: 'Cancel my subscription' })
  cancelMySubscription(@CurrentUser('id') userId: string) { return this.svc.cancelSubscription(userId); }

  @Post('toggle-auto-renew') @ApiBearerAuth() @ApiOperation({ summary: 'Toggle auto-renewal' })
  toggleAutoRenew(@CurrentUser('id') userId: string, @Body('autoRenew') autoRenew: boolean) {
    return this.svc.toggleAutoRenew(userId, autoRenew);
  }

  @Get('history') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Subscription history (admin)' })
  getHistory(@Query() query: PaginationDto) { return this.svc.getHistory(query); }

  @Get() @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get all subscriptions (admin)' })
  getAllSubscriptions(@Query() query: PaginationDto) { return this.svc.getAllSubscriptions(query); }

  @Put(':id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Update subscription status (admin)' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    const valid = Object.values(SubscriptionStatus) as string[];
    if (!valid.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${valid.join(', ')}`);
    }
    return this.svc.updateSubscriptionStatus(id, status);
  }

  @Get('coupons') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get all coupons (admin)' })
  getCoupons(@Query() query: PaginationDto) { return this.svc.getCoupons(query); }

  @Post('coupons') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Create coupon (admin)' })
  createCoupon(@Body() dto: CreateCouponDto) { return this.svc.createCoupon(dto); }

  @Put('coupons/:id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Update coupon (admin)' })
  updateCoupon(@Param('id') id: string, @Body() dto: Partial<CreateCouponDto>) { return this.svc.updateCoupon(id, dto); }

  @Delete('coupons/:id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete coupon (admin)' })
  deleteCoupon(@Param('id') id: string) { return this.svc.deleteCoupon(id); }

  @Post('apply-coupon') @ApiBearerAuth() @ApiOperation({ summary: 'Validate and preview coupon discount (authenticated)' })
  applyCoupon(@Body() dto: ApplyCouponDto) { return this.svc.validateCoupon(dto); }
}
