import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { lockedSeconds, recordFailure, recordSuccess } from './login-throttle';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const refreshExpiresAt = () =>
  new Date(Date.now() + Number(process.env.REFRESH_EXPIRES_DAYS || 30) * 86400000);

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}
  /** ip는 무차별 대입 차단용 — 계정/출발지 각각 5회 연속 실패 시 10분 잠금 */
  async login(email: string, password: string, ip?: string, device?: string) {
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
    // device를 보낸 클라이언트(모바일 앱)에만 refresh 토큰을 발급한다 — 웹은 기존 12시간 그대로
    const refreshToken = device ? await this.issueRefresh(u.id, device) : undefined;
    return {
      accessToken: token,
      ...(refreshToken ? { refreshToken } : {}),
      user: { id: u.id, name: u.name, email: u.email, department: u.department?.name ?? null, roles: u.roleScopes },
    };
  }

  /** refresh 토큰 발급 — 원문은 응답으로만 나가고 DB에는 해시만 남는다 */
  private async issueRefresh(userId: string, deviceInfo?: string) {
    // 만료 지난 행은 이 기회에 청소
    await this.prisma.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    const token = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt: refreshExpiresAt(), deviceInfo: deviceInfo?.slice(0, 200) ?? null },
    });
    return token;
  }

  /** refresh 회전 — 쓴 토큰은 폐기하고 새 쌍(access+refresh)을 준다 */
  async refresh(refreshToken: string) {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: { include: { roleScopes: true, department: true } } },
    });
    if (!row) throw new UnauthorizedException('다시 로그인해주세요');
    if (row.revokedAt) {
      // 이미 회전돼 폐기된 토큰이 다시 옴 = 탈취 가능성 → 이 사용자의 살아있는 토큰 전부 폐기
      await this.prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('다시 로그인해주세요');
    }
    if (row.expiresAt < new Date() || !row.user.isActive) throw new UnauthorizedException('다시 로그인해주세요');
    const next = randomBytes(48).toString('base64url');
    const created = await this.prisma.refreshToken.create({
      data: { userId: row.userId, tokenHash: sha256(next), expiresAt: refreshExpiresAt(), deviceInfo: row.deviceInfo },
    });
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), replacedById: created.id } });
    const u = row.user;
    const accessToken = await this.jwt.signAsync({ sub: u.id });
    return {
      accessToken,
      refreshToken: next,
      user: { id: u.id, name: u.name, email: u.email, department: u.department?.name ?? null, roles: u.roleScopes },
    };
  }

  /** 로그아웃 — 제시된 refresh 토큰만 폐기. 존재 여부는 응답에 드러내지 않는다 */
  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  /** 본인 비밀번호 변경 — 현재 비밀번호를 확인해야 바뀐다(대표의 재설정과 별개) */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u || !(await bcrypt.compare(currentPassword, u.passwordHash)))
      throw new BadRequestException('현재 비밀번호가 올바르지 않습니다');
    if (await bcrypt.compare(newPassword, u.passwordHash))
      throw new BadRequestException('지금 쓰는 비밀번호와 다른 것으로 정해주세요');
    await this.prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
    // 비밀번호가 바뀌면 발급된 refresh 토큰도 전부 무효화한다
    await this.prisma.refreshToken.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }
}
