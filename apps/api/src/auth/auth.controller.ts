import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ScopeService } from '../common/scope/scope.service';
class LoginDto { @IsEmail() email: string; @IsString() password: string; }
class ChangePasswordDto { @IsString() currentPassword: string; @IsString() @MinLength(8) newPassword: string; }
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private scope: ScopeService) {}
  @Public() @Post('login') login(@Body() dto: LoginDto, @Ip() ip: string) { return this.auth.login(dto.email, dto.password, ip); }
  @Get('me') async me(@CurrentUser() u: AuthUser) { return { ...u, effectiveScope: await this.scope.resolve(u) }; }
  @Post('change-password') changePassword(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(u.id, dto.currentPassword, dto.newPassword);
  }
}
