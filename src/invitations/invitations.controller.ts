import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @Roles(Role.MANAGER)
  async create(@Body() dto: CreateInvitationDto, @Request() req: any) {
    const data = await this.invitationsService.create(
      req.user.organizationId,
      req.user.id,
      req.user.role,
      dto,
    );
    return { message: 'Invitation sent successfully', data };
  }

  @Get()
  @Roles(Role.MANAGER)
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Request() req: any,
  ) {
    const result = await this.invitationsService.findAll(
      req.user.organizationId,
      parseInt(page),
      parseInt(limit),
    );
    return { message: 'Invitations retrieved successfully', ...result };
  }

  @Post(':id/resend')
  @Roles(Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async resend(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const data = await this.invitationsService.resend(
      id,
      req.user.organizationId,
    );
    return { message: 'Invitation resent successfully', data };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const data = await this.invitationsService.cancel(
      id,
      req.user.organizationId,
    );
    return { message: 'Invitation cancelled successfully', data };
  }
}
