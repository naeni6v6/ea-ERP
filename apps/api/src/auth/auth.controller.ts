import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ScopeService } from '../common/scope/scope.service';
class LoginDto { @IsEmail() email: string; @IsString() password: string; }
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private scope: ScopeService) {}
  @Public() @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }
  @Get('me') async me(@CurrentUser() u: AuthUser) { return { ...u, effectiveScope: await this.scope.resolve(u) }; }
}
