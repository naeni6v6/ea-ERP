import { IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { DepartmentKind, Role, ScopeType } from '@prisma/client';
export class BusinessTypeDto { @IsString() code: string; @IsString() name: string; @IsOptional() @IsInt() sortOrder?: number; @IsOptional() @IsBoolean() isActive?: boolean; }
export class DepartmentDto { @IsString() code: string; @IsString() name: string; @IsOptional() @IsEnum(DepartmentKind) kind?: DepartmentKind; @IsOptional() @IsInt() sortOrder?: number; @IsOptional() @IsBoolean() isActive?: boolean; }
export class CreateUserDto { @IsEmail() email: string; @IsString() @MinLength(8) password: string; @IsString() name: string; @IsOptional() @IsString() departmentId?: string; }
export class UpdateUserDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsString() departmentId?: string | null; @IsOptional() @IsBoolean() isActive?: boolean; @IsOptional() @IsString() @MinLength(8) password?: string; }
export class RoleScopeDto { @IsEnum(Role) role: Role; @IsEnum(ScopeType) scopeType: ScopeType; @IsOptional() @IsString() businessTypeId?: string; @IsOptional() @IsString() departmentId?: string; @IsOptional() @IsString() projectId?: string; }
export class CodeValueDto { @IsIn(['PROJECT_STATUS', 'TASK_STATUS', 'RESERVE_CATEGORY', 'PLANNED_CATEGORY', 'CARD_PURPOSE']) kind: string; @IsString() code: string; @IsString() label: string; @IsOptional() @IsInt() sortOrder?: number; @IsOptional() @IsBoolean() isActive?: boolean; }

/** 수정용 DTO는 클래스여야 ValidationPipe가 동작한다 (Partial<>는 검증이 건너뛰어짐) */
export class UpdateBusinessTypeDto { @IsOptional() @IsString() code?: string; @IsOptional() @IsString() name?: string; @IsOptional() @IsInt() sortOrder?: number; @IsOptional() @IsBoolean() isActive?: boolean; }
export class UpdateDepartmentDto { @IsOptional() @IsString() code?: string; @IsOptional() @IsString() name?: string; @IsOptional() @IsEnum(DepartmentKind) kind?: DepartmentKind; @IsOptional() @IsInt() sortOrder?: number; @IsOptional() @IsBoolean() isActive?: boolean; }
