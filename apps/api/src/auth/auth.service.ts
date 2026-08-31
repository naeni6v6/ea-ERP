import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { lockedSeconds, recordFailure, recordSuccess } from './login-throttle';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}
  /** ip는 무차별 대입 차단용 — 계정/출발지 각각 5회 연속 실패 시 10분 잠금 */
  async login(email: string, password: string, ip?: string) {
    const keys = [`email:${(email ?? '').toLowerCase()}`, ...(ip ? [`ip:${ip}`] : [])];
    const wait = lockedSeconds(keys);
    if (wait > 0) {
      throw new HttpException(
        `로그인 시도가 너무 많습니다. ${Math.ceil(wait / 60)}분 뒤에 다시 시도하세요.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const u = await this.prisma.user.findUnique({ where: { email }, include: { roleScopes: true, department: true } });
    if (!u || !u.isActive || !(await bcrypt.compare(password, u.passwordHash))) {
      recordFailure(keys);
      // 계정 존재 여부가 드러나지 않도록 실패 메시지는 항상 동일하게 둔다
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }
    recordSuccess(keys);
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
