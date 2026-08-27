import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}
  async login(email: string, password: string) {
    const u = await this.prisma.user.findUnique({ where: { email }, include: { roleScopes: true, department: true } });
    if (!u || !u.isActive || !(await bcrypt.compare(password, u.passwordHash))) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    const token = await this.jwt.signAsync({ sub: u.id });
    return { accessToken: token, user: { id: u.id, name: u.name, email: u.email, department: u.department?.name ?? null, roles: u.roleScopes } };
  }
}
