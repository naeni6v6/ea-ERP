-- 프로젝트 보드 드래그 정렬용 표시 순서
ALTER TABLE "Project" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
