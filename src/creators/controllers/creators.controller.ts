import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../subscriptions/guards/subscription.guard';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { QueryCreatorsDto } from '../dto/query-creators.dto';
import { UpdateCreatorDto } from '../dto/update-creator.dto';
import { CreatorsService } from '../services/creators.service';

@ApiTags('Creators')
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @ApiOperation({ summary: 'List creators' })
  findAll(@Query() query: QueryCreatorsDto) {
    return this.creatorsService.findAll(query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @ApiOperation({ summary: 'Get a creator by id' })
  findOne(@Param('id') id: string) {
    return this.creatorsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a creator' })
  create(@Body() dto: CreateCreatorDto) {
    return this.creatorsService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @ApiOperation({ summary: 'Update a creator' })
  update(@Param('id') id: string, @Body() dto: UpdateCreatorDto) {
    return this.creatorsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @ApiOperation({ summary: 'Delete a creator' })
  remove(@Param('id') id: string) {
    return this.creatorsService.remove(id);
  }
}
