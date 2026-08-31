import { Body, Controller, Get, Param, ParseArrayPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OrgService } from './org.service';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { BusinessTypeDto, CodeValueDto, CreateUserDto, DepartmentDto, RoleScopeDto, UpdateBusinessTypeDto, UpdateDepartmentDto, UpdateUserDto } from './org.dto';

@Controller()
export class OrgController {
  constructor(private org: OrgService) {}

  @Get('business-types') listBt(@CurrentUser() u: AuthUser) { return this.org.listBusinessTypes(u.companyId); }
  @Post('business-types') @Roles(Role.CEO) createBt(@CurrentUser() u: AuthUser, @Body() d: BusinessTypeDto) { return this.org.createBusinessType(u.companyId, d); }
  @Patch('business-types/:id') @Roles(Role.CEO) updateBt(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdateBusinessTypeDto) { return this.org.updateBusinessType(u.companyId, id, d); }

  @Get('departments') listDept(@CurrentUser() u: AuthUser) { return this.org.listDepartments(u.companyId); }
  @Post('departments') @Roles(Role.CEO) createDept(@CurrentUser() u: AuthUser, @Body() d: DepartmentDto) { return this.org.createDepartment(u.companyId, d); }
  @Patch('departments/:id') @Roles(Role.CEO) updateDept(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdateDepartmentDto) { return this.org.updateDepartment(u.companyId, id, d); }

  @Get('users') @Roles(Role.CEO, Role.ADMIN) listUsers(@CurrentUser() u: AuthUser) { return this.org.listUsers(u.companyId); }
  @Post('users') @Roles(Role.CEO) createUser(@CurrentUser() u: AuthUser, @Body() d: CreateUserDto) { return this.org.createUser(u, d); }
  @Patch('users/:id') @Roles(Role.CEO) updateUser(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdateUserDto) { return this.org.updateUser(u, id, d); }
  /** 배열 본문은 ValidationPipe가 그냥 통과시키므로 ParseArrayPipe로 항목마다 검증한다 */
  @Put('users/:id/role-scopes') @Roles(Role.CEO) setScopes(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ParseArrayPipe({ items: RoleScopeDto, whitelist: true })) scopes: RoleScopeDto[]) { return this.org.setRoleScopes(u, id, scopes); }

  /** 오늘의 공지 — 조회는 전 직원, 등록·수정·삭제(빈 내용)는 CEO/ADMIN */
  @Get('notices/today') todayNotice(@CurrentUser() u: AuthUser) { return this.org.todayNotice(u.companyId); }
  @Put('notices/today') @Roles(Role.CEO, Role.ADMIN) setTodayNotice(@CurrentUser() u: AuthUser, @Body('content') content: string) { return this.org.setTodayNotice(u, content ?? ''); }

  @Get('code-values') listCodes(@CurrentUser() u: AuthUser, @Query('kind') kind?: string) { return this.org.listCodes(u.companyId, kind); }
  @Put('code-values') @Roles(Role.CEO) upsertCode(@CurrentUser() u: AuthUser, @Body() d: CodeValueDto) { return this.org.upsertCode(u.companyId, d); }
}
