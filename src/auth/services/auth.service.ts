import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { UsersService } from '../../users/services/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });
    await this.ensureFreeSubscription(user.id);

    const tokens = await this.generateTokens(user.id, user.email, user.fullName);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.usersService.toSafeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.ensureFreeSubscription(user.id);

    const tokens = await this.generateTokens(user.id, user.email, user.fullName);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.usersService.toSafeUser(user),
      ...tokens,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const refreshMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!refreshMatches) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.fullName);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.usersService.toSafeUser(user),
      ...tokens,
    };
  }

  async logout(userId: string) {
    await this.usersService.clearRefreshToken(userId);
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(userId: string, email: string, fullName: string) {
    const accessExpiresIn =
      this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN');
    const refreshExpiresIn =
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, fullName, tokenType: 'access' },
        {
          secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: accessExpiresIn as never,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, fullName, tokenType: 'refresh' },
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: refreshExpiresIn as never,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async ensureFreeSubscription(userId: string) {
    if (this.configService.get<boolean>('PAYMENT_ENABLED') !== false) {
      return;
    }

    const existingFreeSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        flutterwaveReference: { startsWith: 'free-' },
      },
    });
    if (existingFreeSubscription) {
      return;
    }

    await this.prisma.subscription.create({
      data: {
        userId,
        plan: SubscriptionPlan.INDIVIDUAL,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: false,
        flutterwaveReference: `free-${userId}`,
        expiresAt: new Date('2099-12-31T23:59:59.999Z'),
      },
    });
  }
}
