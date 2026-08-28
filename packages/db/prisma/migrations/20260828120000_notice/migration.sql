-- 오늘의 공지 배너
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "noticeDate" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notice_companyId_noticeDate_key" ON "Notice"("companyId", "noticeDate");

ALTER TABLE "Notice" ADD CONSTRAINT "Notice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
