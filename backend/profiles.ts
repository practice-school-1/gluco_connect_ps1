import * as bcrypt from 'bcrypt';
import { Controller, Post, Get, Patch, Body, UseGuards, Request, Injectable, NotFoundException, ConflictException, Module } from '@nestjs/common';
import { JwtAuthGuard } from './auth';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { IsNotEmpty, IsOptional, IsString, IsInt, IsDateString, IsEnum, IsNumber, IsEmail } from 'class-validator';
import { Gender, DiabetesType } from '@prisma/client';

export class CreateDoctorProfileDto {
  @ApiProperty({ example: 'Dr. John Doe' })
  @IsNotEmpty()
  @IsString()
  full_name: string;

  @ApiProperty({ example: 'MED123456' })
  @IsNotEmpty()
  @IsString()
  license_number: string;

  @ApiPropertyOptional({ example: 'Endocrinology' })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({ example: 'City Hospital' })
  @IsOptional()
  @IsString()
  clinic_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  years_of_experience?: number;
}

export class UpdateDoctorProfileDto extends CreateDoctorProfileDto {}

export class CreatePatientProfileDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty()
  @IsString()
  full_name: string;

  @ApiProperty({ example: '1990-01-01' })
  @IsNotEmpty()
  @IsDateString()
  date_of_birth: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ enum: DiabetesType })
  @IsOptional()
  @IsEnum(DiabetesType)
  diabetes_type?: DiabetesType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  height_cm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight_kg?: number;
}

export class UpdatePatientProfileDto extends CreatePatientProfileDto {}

export class LinkDoctorDto {
  @ApiProperty({ example: 'ABCDEF' })
  @IsNotEmpty()
  @IsString()
  invite_code: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'patient@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'newpassword123' })
  @IsOptional()
  @IsString()
  password?: string;
}

@Injectable()
export class DoctorsService {
  constructor(private prisma: PrismaService) {}

  async createProfile(userId: string, dto: CreateDoctorProfileDto) {
    const existing = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (existing) throw new ConflictException('Doctor profile already exists');

    // Generate a simple invite code
    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();

    return this.prisma.doctor.create({
      data: {
        user_id: userId,
        invite_code,
        ...dto,
      },
    });
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Doctor profile not found');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateDoctorProfileDto) {
    const profile = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Doctor profile not found');

    return this.prisma.doctor.update({
      where: { user_id: userId },
      data: dto,
    });
  }

  async getMyPatients(userId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const patients = await this.prisma.patient.findMany({
      where: { doctor_id: doctor.id },
      include: {
        user: { select: { id: true, phone: true, email: true, is_active: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // Attach latest glucose reading to each patient
    const enriched = await Promise.all(patients.map(async (p) => {
      const latest = await this.prisma.glucoseReading.findFirst({
        where: { patient_id: p.id },
        orderBy: { recorded_at: 'desc' },
      });
      const unresolvedAlerts = await this.prisma.alert.count({
        where: { patient_id: p.id, is_resolved: false },
      });
      return { ...p, latest_glucose: latest, unresolved_alerts: unresolvedAlerts };
    }));

    return enriched;
  }
}

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async createProfile(userId: string, dto: CreatePatientProfileDto) {
    const existing = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (existing) throw new ConflictException('Patient profile already exists');

    return this.prisma.patient.create({
      data: {
        user_id: userId,
        full_name: dto.full_name,
        date_of_birth: new Date(dto.date_of_birth),
        gender: dto.gender,
        diabetes_type: dto.diabetes_type,
        height_cm: dto.height_cm,
        weight_kg: dto.weight_kg,
      },
    });
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Patient profile not found');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdatePatientProfileDto) {
    const profile = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Patient profile not found');

    const data: any = { ...dto };
    if (dto.date_of_birth) data.date_of_birth = new Date(dto.date_of_birth);

    return this.prisma.patient.update({
      where: { user_id: userId },
      data,
    });
  }

  async linkDoctor(userId: string, dto: LinkDoctorDto) {
    const doctor = await this.prisma.doctor.findUnique({ where: { invite_code: dto.invite_code } });
    if (!doctor) throw new NotFoundException('Invalid invite code');

    const profile = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Patient profile not found');

    return this.prisma.patient.update({
      where: { user_id: userId },
      data: { doctor_id: doctor.id },
    });
  }
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, email: true, role: true, is_active: true, is_phone_verified: true, created_at: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const data: any = { ...dto };
    if (dto.password) {
      data.password_hash = await bcrypt.hash(dto.password, 10);
      delete data.password;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, phone: true, email: true, role: true, is_active: true, is_phone_verified: true, updated_at: true },
    });
    return updated;
  }
}

@ApiTags('Doctors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post('profile')
  @ApiOperation({ summary: 'Create doctor profile after signup' })
  createProfile(@Request() req, @Body() dto: CreateDoctorProfileDto) {
    return this.doctorsService.createProfile(req.user.userId, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get own doctor profile' })
  getProfile(@Request() req) {
    return this.doctorsService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update doctor profile' })
  updateProfile(@Request() req, @Body() dto: UpdateDoctorProfileDto) {
    return this.doctorsService.updateProfile(req.user.userId, dto);
  }

  @Get('patients')
  @ApiOperation({ summary: 'Get all patients linked to this doctor' })
  getMyPatients(@Request() req) {
    return this.doctorsService.getMyPatients(req.user.userId);
  }
}

@ApiTags('Patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post('profile')
  @ApiOperation({ summary: 'Create patient profile after signup' })
  createProfile(@Request() req, @Body() dto: CreatePatientProfileDto) {
    return this.patientsService.createProfile(req.user.userId, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get own patient profile' })
  getProfile(@Request() req) {
    return this.patientsService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update patient profile' })
  updateProfile(@Request() req, @Body() dto: UpdatePatientProfileDto) {
    return this.patientsService.updateProfile(req.user.userId, dto);
  }

  @Post('link-doctor')
  @ApiOperation({ summary: 'Link to a doctor using an invite code' })
  linkDoctor(@Request() req, @Body() dto: LinkDoctorDto) {
    return this.patientsService.linkDoctor(req.user.userId, dto);
  }
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current logged-in user profile' })
  getMe(@Request() req) {
    return this.usersService.getMe(req.user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update basic user info' })
  updateMe(@Request() req, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(req.user.userId, dto);
  }
}

@Module({
  controllers: [
    UsersController,
    DoctorsController,
    PatientsController
  ],
  providers: [
    UsersService,
    DoctorsService,
    PatientsService
  ]
})
export class ProfilesModule {}
