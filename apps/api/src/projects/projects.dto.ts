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

/**
 * 수정용 DTO는 반드시 '클래스'여야 한다.
 * Partial<TaskDto> 같은 타입만 쓰면 ValidationPipe가 metatype을 Object로 보고 검증을 통째로 건너뛰어,
 * 본문의 임의 키(projectId, deletedAt 등)가 그대로 Prisma update 로 넘어간다(mass assignment).
 */
export class UpdateTaskDto {
  @IsOptional() @IsString() title?: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() assigneeId?: string | null;
  @IsOptional() @IsString() dueDate?: string | null; @IsOptional() @IsString() priority?: string; @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() isDone?: boolean; @IsOptional() @IsInt() weight?: number; @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() code?: string; @IsOptional() @IsString() name?: string; @IsOptional() @IsString() businessTypeId?: string; @IsOptional() @IsString() leadDepartmentId?: string;
  @IsOptional() @IsArray() departmentIds?: string[]; @IsOptional() @IsArray() memberUserIds?: string[];
  @IsOptional() @IsString() ownerUserId?: string; @IsOptional() @IsString() status?: string; @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() goal?: string; @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() startDate?: string; @IsOptional() @IsString() planEndDate?: string; @IsOptional() @IsString() actualEndDate?: string;
  @IsOptional() contractAmount?: string | number; @IsOptional() expectedRevenue?: string | number; @IsOptional() budgetAmount?: string | number;
  @IsOptional() targetCost?: string | number; @IsOptional() targetProfit?: string | number; @IsOptional() @IsBoolean() financeVisibleToMembers?: boolean;
}
