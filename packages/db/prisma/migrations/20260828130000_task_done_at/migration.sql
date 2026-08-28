-- 업무 완료 시각 (일별 완료 현황 차트용)
ALTER TABLE "Task" ADD COLUMN "doneAt" TIMESTAMP(3);

-- 기존 완료 업무는 마지막 수정 시각으로 근사 백필
UPDATE "Task" SET "doneAt" = "updatedAt" WHERE "isDone" = true;
