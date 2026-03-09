import {
  Controller,
  Get,
  Post,
  Patch,
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
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @Roles(Role.CASHIER)
  async findAll(@Request() req: any) {
    const data = await this.locationsService.findAll(req.user.organizationId);
    return { message: 'Locations retrieved successfully', data };
  }

  @Get(':id')
  @Roles(Role.CASHIER)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const data = await this.locationsService.findOne(
      id,
      req.user.organizationId,
    );
    return { message: 'Location retrieved successfully', data };
  }

  @Post()
  @Roles(Role.MANAGER)
  async create(@Body() dto: CreateLocationDto, @Request() req: any) {
    const data = await this.locationsService.create(
      req.user.organizationId,
      dto,
    );
    return { message: 'Location created successfully', data };
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @Request() req: any,
  ) {
    const data = await this.locationsService.update(
      id,
      req.user.organizationId,
      dto,
    );
    return { message: 'Location updated successfully', data };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  async remove(@Param('id') id: string, @Request() req: any) {
    const data = await this.locationsService.remove(
      id,
      req.user.organizationId,
    );
    return { message: 'Location deactivated successfully', data };
  }

  // ─── User Assignment ──────────────────────────────────────────────────────

  @Get(':id/users')
  @Roles(Role.CASHIER)
  async getLocationUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Request() req: any,
  ) {
    const result = await this.locationsService.getLocationUsers(
      id,
      req.user.organizationId,
      parseInt(page),
      parseInt(limit),
    );
    return { message: 'Location users retrieved successfully', ...result };
  }

  @Post(':id/users')
  @Roles(Role.MANAGER)
  async assignUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignUserDto,
    @Request() req: any,
  ) {
    const data = await this.locationsService.assignUser(
      id,
      req.user.organizationId,
      req.user.id,
      req.user.role,
      dto.userId,
    );
    return { message: 'User assigned to location successfully', data };
  }

  @Delete(':id/users/:userId')
  @Roles(Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async unassignUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ) {
    const data = await this.locationsService.unassignUser(
      id,
      req.user.organizationId,
      req.user.id,
      req.user.role,
      userId,
    );
    return { message: 'User unassigned from location successfully', data };
  }
}
