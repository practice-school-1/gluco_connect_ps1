import * as bcrypt from 'bcrypt';
import { Controller, Post, Body, HttpCode, HttpStatus, Module, Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { Role } from '@prisma/client';
import { IsNotEmpty, IsPhoneNumber, IsString, IsEmail, IsOptional } from 'class-validator';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Twilio } from 'twilio';

export class SendOtpDto {
  @ApiProperty({ example: '+919876543210', description: 'Phone number with country code' })
  @IsNotEmpty()
  @IsString()
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  @IsString()
  otp: string;
}

export class LoginDto {
  @ApiProperty({ example: 'doctor@example.com' })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ example: 'securepassword123' })
  @IsNotEmpty()
  @IsString()
  password: string;
}

export class RegisterDoctorDto {
  @ApiProperty({ example: 'doctor@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securepassword123' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  phone?: string;
}

@Injectable()
export class AuthService {
  private readonly twilioClient: Twilio | null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
    this.twilioClient =
      TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
        ? new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        : null;
  }

  async sendOtp(dto: SendOtpDto) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const otpHash = await bcrypt.hash(otp, 10);

    await this.prisma.otpVerification.create({
      data: {
        phone: dto.phone,
        otp_hash: otpHash,
        expires_at: expiresAt,
      },
    });

    if (process.env.TWO_FACTOR_API_KEY) {
      const phoneDigits = dto.phone.replace(/^\+/, '');
      const url = `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/${phoneDigits}/${otp}/OTP1`;
      const response = await fetch(url);
      const result = await response.json();
      if (result.Status !== 'Success') {
        console.error(`[2Factor] OTP send failed for ${dto.phone}:`, result.Details);
      }
    } else if (this.twilioClient && process.env.TWILIO_PHONE_NUMBER) {
      await this.twilioClient.messages.create({
        body: `Your GlucoConnect verification code is ${otp}. It expires in 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: dto.phone,
      });
    } else {
      console.log(`[DEV ONLY] OTP for ${dto.phone} is ${otp}`);
    }

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: { phone: dto.phone, is_used: false, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });

    if (!otpRecord) throw new BadRequestException('Invalid or expired OTP');

    const isValid = await bcrypt.compare(dto.otp, otpRecord.otp_hash);
    if (!isValid) throw new BadRequestException('Invalid OTP');

    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { is_used: true },
    });

    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          role: Role.patient, // Default role
          is_phone_verified: true,
        },
      });
    }

    const payload = { sub: user.id, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.password_hash) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user,
    };
  }

  async registerDoctor(dto: RegisterDoctorDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password_hash,
        phone: dto.phone,
        role: Role.doctor,
      },
    });

    const payload = { sub: user.id, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user,
    };
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.query?.token || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key',
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, role: payload.role };
  }
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an OTP to a phone number' })
  sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an OTP and get a JWT token' })
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login for doctors using email/password' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register/doctor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new doctor account' })
  registerDoctor(@Body() dto: RegisterDoctorDto) {
    return this.authService.registerDoctor(dto);
  }
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'super-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
