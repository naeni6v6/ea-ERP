import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
export class ProjectDto {
  @IsString() code: string; @IsString() name: string; @IsString() businessTypeId: string; @IsString() leadDepartmentId: string;
  @IsOptional() @IsArray() departmentIds?: string[]; @IsOptional() @IsArray() memberUserIds?: string[];
  @IsOptional() @IsString() ownerUserId?: string; @IsOptional() @IsString() status?: string; @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() goal?: string; @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() startDate?: string; @IsOptional() @IsString() planEndDate?: string; @IsOptional() @IsString() actualEndDate?: string;
  @IsOptional() contractAmount?: string | number; @IsOptional() expectedRevenue?: string | number; @IsOptional() budgetAmount?: string | number;
  @IsOptional() targetCost?: string | number; @IsOptional() targetProfit?: string | number; @IsOptional() @IsBoolean() financeVisibleToMembers?: boolean;
}
export class WorkLogDto {
  /** YYYY-MM-DD */
  @IsString() date: string;
  @IsString() content: string;
}
export class ReorderDto {
  /** 보드 표시 순서대로 나열한 프로젝트 id — index가 곧 sortOrder */
  @IsArray() @IsString({ each: true }) ids: string[];
}
export class TaskDto {
  @IsString() title: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() assigneeId?: string | null;
  @IsOptional() @IsString() dueDate?: string | null; @IsOptional() @IsString() priority?: string; @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() isDone?: boolean; @IsOptional() @IsInt() weight?: number; @IsOptional() @IsInt() sortOrder?: number;
}
