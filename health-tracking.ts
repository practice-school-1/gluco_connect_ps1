import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, Injectable, NotFoundException, ForbiddenException, Module } from '@nestjs/common';
import { JwtAuthGuard } from './auth';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { IsOptional, IsString, IsInt, IsEnum, IsDateString, IsNumber, IsNotEmpty, IsUUID, IsBoolean, ValidateNested, IsArray } from 'class-validator';
import { ActivitySource, Intensity, ReadingType, ReadingSource, MealType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateActivityDto {
  @ApiPropertyOptional({ enum: ActivitySource, default: ActivitySource.manual })
  @IsOptional()
  @IsEnum(ActivitySource)
  source?: ActivitySource;

  @ApiPropertyOptional({ example: 'walking' })
  @IsOptional()
  @IsString()
  activity_type?: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsInt()
  steps?: number;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsInt()
  active_minutes?: number;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @IsNumber()
  calories_burned?: number;

  @ApiPropertyOptional({ example: 3.2 })
  @IsOptional()
  @IsNumber()
  distance_km?: number;

  @ApiPropertyOptional({ example: 78 })
  @IsOptional()
  @IsInt()
  heart_rate_avg?: number;

  @ApiPropertyOptional({ example: 110 })
  @IsOptional()
  @IsInt()
  heart_rate_max?: number;

  @ApiPropertyOptional({ enum: Intensity })
  @IsOptional()
  @IsEnum(Intensity)
  intensity?: Intensity;

  @ApiPropertyOptional({ example: 'Felt great after run' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: '2023-10-01T07:00:00Z' })
  @IsDateString()
  started_at: string;

  @ApiPropertyOptional({ example: '2023-10-01T07:45:00Z' })
  @IsOptional()
  @IsDateString()
  ended_at?: string;

  @ApiProperty({ example: '2023-10-01' })
  @IsDateString()
  date: string;
}

export class UpdateActivityDto extends CreateActivityDto {}

export class CreateGlucoseReadingDto {
  @ApiProperty({ example: 105.5 })
  @IsNotEmpty()
  @IsNumber()
  value_mg_dl: number;

  @ApiProperty({ enum: ReadingType })
  @IsNotEmpty()
  @IsEnum(ReadingType)
  reading_type: ReadingType;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  meal_id?: string;

  @ApiPropertyOptional({ enum: ReadingSource, default: ReadingSource.manual })
  @IsOptional()
  @IsEnum(ReadingSource)
  source?: ReadingSource;

  @ApiPropertyOptional({ example: 'CGM-SN-12345' })
  @IsOptional()
  @IsString()
  device_id?: string;

  @ApiPropertyOptional({ example: 'Felt a bit dizzy' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: '2023-10-01T08:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  recorded_at: string;
}

export class UpdateGlucoseReadingDto {
  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  value_mg_dl?: number;

  @ApiPropertyOptional({ enum: ReadingType })
  @IsOptional()
  @IsEnum(ReadingType)
  reading_type?: ReadingType;

  @ApiPropertyOptional({ example: 'Updated note' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMealItemDto {
  @ApiProperty({ example: 'Chapati' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '2 pieces' })
  @IsOptional()
  @IsString()
  quantity?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  carbs_grams?: number;

  @ApiPropertyOptional({ example: 140 })
  @IsOptional()
  @IsNumber()
  calories?: number;

  @ApiPropertyOptional({ example: 'medium' })
  @IsOptional()
  @IsString()
  glycemic_index?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_regional?: boolean;
}

export class CreateMealDto {
  @ApiProperty({ enum: MealType })
  @IsNotEmpty()
  @IsEnum(MealType)
  meal_type: MealType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photo_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: '2023-10-01T13:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  logged_at: string;

  @ApiProperty({ type: [CreateMealItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMealItemDto)
  meal_items?: CreateMealItemDto[];
}

export class UpdateMealDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AnalyzePhotoDto {
  @ApiProperty({ example: 'https://s3.bucket/meal.jpg' })
  @IsNotEmpty()
  @IsString()
  photo_url: string;
}

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateActivityDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { user_id: userId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    return this.prisma.activity.create({
      data: {
        patient_id: patient.id,
        ...dto,
        started_at: new Date(dto.started_at),
        ended_at: dto.ended_at ? new Date(dto.ended_at) : null,
        date: new Date(dto.date),
      },
    });
  }

  async findAll(userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { user_id: userId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.activity.findMany({
      where: {
        patient_id: patient.id,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');

    const patient = await this.prisma.patient.findUnique({
      where: { user_id: userId },
    });
    if (activity.patient_id !== patient?.id) throw new ForbiddenException();

    return activity;
  }

  async update(userId: string, id: string, dto: UpdateActivityDto) {
    const activity = await this.findOne(userId, id);
    return this.prisma.activity.update({
      where: { id: activity.id },
      data: {
        ...dto,
        started_at: dto.started_at ? new Date(dto.started_at) : undefined,
        ended_at: dto.ended_at ? new Date(dto.ended_at) : undefined,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.activity.delete({ where: { id } });
  }

  async getSummary(userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { user_id: userId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const data = await this.prisma.activity.groupBy({
      by: ['date'],
      where: {
        patient_id: patient.id,
        date: { gte: sevenDaysAgo },
      },
      _sum: {
        steps: true,
        active_minutes: true,
        calories_burned: true,
      },
    });
    return data;
  }
}

@Injectable()
export class GlucoseService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateGlucoseReadingDto) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient profile required to log glucose');

    return this.prisma.glucoseReading.create({
      data: {
        patient_id: patient.id,
        value_mg_dl: dto.value_mg_dl,
        reading_type: dto.reading_type,
        meal_id: dto.meal_id,
        source: dto.source,
        device_id: dto.device_id,
        notes: dto.notes,
        recorded_at: new Date(dto.recorded_at),
      },
    });
  }

  async findAll(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) return [];

    // Defaulting to last 30 days as agreed
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.glucoseReading.findMany({
      where: { 
        patient_id: patient.id,
        recorded_at: { gte: thirtyDaysAgo }
      },
      orderBy: { recorded_at: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    const reading = await this.prisma.glucoseReading.findUnique({ where: { id } });

    if (!reading) throw new NotFoundException('Glucose reading not found');
    if (patient && reading.patient_id !== patient.id) throw new ForbiddenException('Access denied');

    return reading;
  }

  async update(userId: string, id: string, dto: UpdateGlucoseReadingDto) {
    await this.findOne(userId, id); // validates ownership

    return this.prisma.glucoseReading.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // validates ownership

    return this.prisma.glucoseReading.delete({
      where: { id },
    });
  }
}

@Injectable()
export class MealsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateMealDto) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient profile required to log a meal');

    let total_carbs = 0;
    let total_calories = 0;

    if (dto.meal_items) {
      dto.meal_items.forEach(item => {
        total_carbs += item.carbs_grams || 0;
        total_calories += item.calories || 0;
      });
    }

    return this.prisma.meal.create({
      data: {
        patient_id: patient.id,
        meal_type: dto.meal_type,
        photo_url: dto.photo_url,
        notes: dto.notes,
        logged_at: new Date(dto.logged_at),
        total_carbs_grams: total_carbs,
        total_calories: total_calories,
        meal_items: {
          create: dto.meal_items || [],
        },
      },
      include: { meal_items: true },
    });
  }

  async analyzePhoto(dto: AnalyzePhotoDto) {
    // Stub implementation for AI Analysis
    return {
      message: 'AI Analysis complete (Stub)',
      detected_items: [
        { name: 'Dal Tadka', quantity: '1 bowl', carbs_grams: 28, calories: 180, glycemic_index: 'medium', is_regional: true },
        { name: 'Chapati', quantity: '2 pieces', carbs_grams: 30, calories: 140, glycemic_index: 'medium', is_regional: true },
      ],
      estimated_total_carbs: 58,
      estimated_total_calories: 320
    };
  }

  async findAll(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) return [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.meal.findMany({
      where: { 
        patient_id: patient.id,
        logged_at: { gte: thirtyDaysAgo }
      },
      include: { meal_items: true },
      orderBy: { logged_at: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    const meal = await this.prisma.meal.findUnique({ where: { id }, include: { meal_items: true } });

    if (!meal) throw new NotFoundException('Meal not found');
    if (patient && meal.patient_id !== patient.id) throw new ForbiddenException('Access denied');

    return meal;
  }

  async update(userId: string, id: string, dto: UpdateMealDto) {
    await this.findOne(userId, id); // validates ownership

    return this.prisma.meal.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // validates ownership

    // Glucose readings attached to this meal are NOT deleted.
    // The ON DELETE SET NULL constraint handles detaching them automatically at DB level.
    
    return this.prisma.meal.delete({
      where: { id },
    });
  }
}

@ApiTags('Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @ApiOperation({ summary: 'Log a manual activity' })
  create(@Request() req, @Body() dto: CreateActivityDto) {
    return this.activitiesService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get activity history (last 30 days)' })
  findAll(@Request() req) {
    return this.activitiesService.findAll(req.user.userId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get daily/weekly step & active‑minute totals' })
  summary(@Request() req) {
    return this.activitiesService.getSummary(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single activity' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.activitiesService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit an activity entry' })
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.activitiesService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an activity entry' })
  remove(@Request() req, @Param('id') id: string) {
    return this.activitiesService.remove(req.user.userId, id);
  }
}

@ApiTags('Glucose Readings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('glucose')
export class GlucoseController {
  constructor(private readonly glucoseService: GlucoseService) {}

  @Post()
  @ApiOperation({ summary: 'Log a new glucose reading' })
  create(@Request() req, @Body() createGlucoseDto: CreateGlucoseReadingDto) {
    return this.glucoseService.create(req.user.userId, createGlucoseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get readings for the last 30 days' })
  findAll(@Request() req) {
    return this.glucoseService.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific reading' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.glucoseService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a reading' })
  update(@Request() req, @Param('id') id: string, @Body() updateGlucoseDto: UpdateGlucoseReadingDto) {
    return this.glucoseService.update(req.user.userId, id, updateGlucoseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a reading' })
  remove(@Request() req, @Param('id') id: string) {
    return this.glucoseService.remove(req.user.userId, id);
  }
}

@ApiTags('Meals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meals')
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Post()
  @ApiOperation({ summary: 'Log a new meal with items' })
  create(@Request() req, @Body() createMealDto: CreateMealDto) {
    return this.mealsService.create(req.user.userId, createMealDto);
  }

  @Post('analyze-photo')
  @ApiOperation({ summary: 'Mock AI Photo Analysis' })
  analyzePhoto(@Body() analyzePhotoDto: AnalyzePhotoDto) {
    return this.mealsService.analyzePhoto(analyzePhotoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get meals for the last 30 days' })
  findAll(@Request() req) {
    return this.mealsService.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific meal details' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.mealsService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit meal details' })
  update(@Request() req, @Param('id') id: string, @Body() updateMealDto: UpdateMealDto) {
    return this.mealsService.update(req.user.userId, id, updateMealDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a meal' })
  remove(@Request() req, @Param('id') id: string) {
    return this.mealsService.remove(req.user.userId, id);
  }
}

@Module({
  controllers: [
    GlucoseController,
    MealsController,
    ActivitiesController
  ],
  providers: [
    GlucoseService,
    MealsService,
    ActivitiesService
  ]
})
export class HealthTrackingModule {}
