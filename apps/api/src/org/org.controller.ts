import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OrgService } from './org.service';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { BusinessTypeDto, CodeValueDto, CreateUserDto, DepartmentDto, RoleScopeDto, UpdateUserDto } from './org.dto';

@Controller()
export class OrgController {
  constructor(private org: OrgService) {}

  @Get('business-types') listBt(@CurrentUser() u: AuthUser) { return this.org.listBusinessTypes(u.companyId); }
  @Post('business-types') @Roles(Role.CEO) createBt(@CurrentUser() u: AuthUser, @Body() d: BusinessTypeDto) { return this.org.createBusinessType(u.companyId, d); }
  @Patch('business-types/:id') @Roles(Role.CEO) updateBt(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: Partial<BusinessTypeDto>) { return this.org.updateBusinessType(u.companyId, id, d); }

  @Get('departments') listDept(@CurrentUser() u: AuthUser) { return this.org.listDepartments(u.companyId); }
  @Post('departments') @Roles(Role.CEO) createDept(@CurrentUser() u: AuthUser, @Body() d: DepartmentDto) { return this.org.createDepartment(u.companyId, d); }
  @Patch('departments/:id') @Roles(Role.CEO) updateDept(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: Partial<DepartmentDto>) { return this.org.updateDepartment(u.companyId, id, d); }

  @Get('users') @Roles(Role.CEO, Role.ADMIN) listUsers(@CurrentUser() u: AuthUser) { return this.org.listUsers(u.companyId); }
  @Post('users') @Roles(Role.CEO) createUser(@CurrentUser() u: AuthUser, @Body() d: CreateUserDto) { return this.org.createUser(u, d); }
  @Patch('users/:id') @Roles(Role.CEO) updateUser(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdateUserDto) { return this.org.updateUser(u, id, d); }
  @Put('users/:id/role-scopes') @Roles(Role.CEO) setScopes(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() scopes: RoleScopeDto[]) { return this.org.setRoleScopes(u, id, scopes); }

  @Get('code-values') listCodes(@CurrentUser() u: AuthUser, @Query('kind') kind?: string) { return this.org.listCodes(u.companyId, kind); }
  @Put('code-values') @Roles(Role.CEO) upsertCode(@CurrentUser() u: AuthUser, @Body() d: CodeValueDto) { return this.org.upsertCode(u.companyId, d); }
}
