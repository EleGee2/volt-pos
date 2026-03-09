import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
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
  async findOne(@Param('id') id: string, @Request() req: any) {
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
}
