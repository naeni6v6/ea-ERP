import { IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { AccountCategory, PartnerType, PlSection } from '@prisma/client';

export const ENTRY_TYPES = ['SALES', 'CASH_SALES', 'RECEIPT_AR', 'EXPENSE', 'CASH_EXPENSE', 'PAYMENT_AP', 'PREPAID', 'PREPAID_AMORTIZE', 'CONTRACT_PREPAY', 'CONTRACT_RECOGNIZE', 'OTHER_INCOME', 'TRANSFER', 'MANUAL'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export class DimsDto { @IsOptional() @IsString() businessTypeId?: string; @IsOptional() @IsString() departmentId?: string; @IsOptional() @IsString() projectId?: string; @IsOptional() @IsString() ownerUserId?: string; }
export class ManualLineDto { @IsString() accountId: string; @IsOptional() debit?: string | number; @IsOptional() credit?: string | number; @IsOptional() @IsString() bankAccountId?: string; @IsOptional() @IsString() memo?: string; @IsOptional() dims?: DimsDto; }

export class CreateEntryDto {
  @IsIn(ENTRY_TYPES as unknown as string[]) type: EntryType;
  @IsString() entryDate: string; // YYYY-MM-DD
  @IsOptional() @IsString() memo?: string;
  @IsOptional() @IsString() partnerId?: string;
  /** 공급가액(원). MANUAL/TRANSFER 제외 필수 */
  @IsOptional() amount?: string | number;
  /** 부가세(원). 기본 0 (Q6: 공급가액 기준 기록) */
  @IsOptional() vatAmount?: string | number;
  /** 매출/비용 계정 (미지정 시 템플릿 기본계정) */
  @IsOptional() @IsString() accountId?: string;
  /** 현금 이동 계좌 (CASH_* / RECEIPT_AR / PAYMENT_AP / PREPAID / CONTRACT_PREPAY / OTHER_INCOME) */
  @IsOptional() @IsString() bankAccountId?: string;
  /** TRANSFER 전용: 입금 계좌 */
  @IsOptional() @IsString() toBankAccountId?: string;
  /** 은행 원본거래 분류 시 연결 (새 은행거래를 만들지 않음) */
  @IsOptional() @IsString() bankTransactionId?: string;
  @IsOptional() dims?: DimsDto;
  @IsOptional() @IsArray() lines?: ManualLineDto[];
}
export class AccountDto { @IsString() code: string; @IsString() name: string; @IsEnum(AccountCategory) category: AccountCategory; @IsOptional() @IsEnum(PlSection) plSection?: PlSection; @IsOptional() @IsString() systemKey?: string; @IsOptional() @IsString() parentId?: string; @IsOptional() @IsBoolean() isActive?: boolean; }
export class PartnerDto { @IsString() name: string; @IsOptional() @IsEnum(PartnerType) type?: PartnerType; @IsOptional() @IsString() bizNo?: string; @IsOptional() @IsString() contact?: string; @IsOptional() @IsString() memo?: string; }
