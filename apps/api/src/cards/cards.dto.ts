import { Allow, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { CardSource, CardType } from '@prisma/client';

export class CardDto {
  @IsString() name: string;
  @IsString() issuer: string;
  @IsOptional() @IsEnum(CardType) cardType?: CardType;
  @IsOptional() @IsString() last4?: string;
  @IsOptional() @IsString() holderUserId?: string | null;
  @IsOptional() @IsString() bankAccountId?: string | null;
  @IsOptional() @IsEnum(CardSource) source?: CardSource;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CardExpenseCreateDto {
  @IsString() cardId: string;
  @IsString() usedAt: string; // ISO 일시 또는 YYYY-MM-DD
  @Allow() amount: string | number;
  @IsOptional() @IsString() storeName?: string;
  @IsOptional() @IsString() approvalNo?: string;
  @IsOptional() @IsString() purposeText?: string;
  @IsOptional() @IsString() memo?: string;
}

export class PurposeDto {
  @IsString() purposeText: string;
  @IsOptional() @IsString() memo?: string;
}

export class MemoDto {
  @IsString() memo: string;
}

export class RejectDto {
  @IsString() reason: string;
}

export class DimsUpdateDto {
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() businessTypeId?: string;
}

export class BulkIdsDto {
  @IsString({ each: true }) ids: string[];
}

export class DeriveDto {
  @IsOptional() @IsString() from?: string; // YYYY-MM-DD
  @IsOptional() @IsString() to?: string;
}
