import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/locations')
  @Roles(Role.CASHIER)
  async getUserLocations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Request() req: any,
  ) {
    const result = await this.usersService.findLocations(
      id,
      req.user.id,
      req.user.role,
      req.user.organizationId,
      parseInt(page),
      parseInt(limit),
    );
    return { message: 'User locations retrieved successfully', ...result };
  }
}
