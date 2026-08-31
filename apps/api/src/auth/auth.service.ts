import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
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

  /** 본인 비밀번호 변경 — 현재 비밀번호를 확인해야 바뀐다(대표의 재설정과 별개) */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u || !(await bcrypt.compare(currentPassword, u.passwordHash)))
      throw new BadRequestException('현재 비밀번호가 올바르지 않습니다');
    if (await bcrypt.compare(newPassword, u.passwordHash))
      throw new BadRequestException('지금 쓰는 비밀번호와 다른 것으로 정해주세요');
    await this.prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
    return { ok: true };
  }
}
