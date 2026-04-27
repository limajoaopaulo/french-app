-- AlterTable
ALTER TABLE "Session" ADD COLUMN "bossQueue" TEXT;
ALTER TABLE "Session" ADD COLUMN "levelMax" INTEGER;
ALTER TABLE "Session" ADD COLUMN "levelMin" INTEGER;
ALTER TABLE "Session" ADD COLUMN "targetSubs" TEXT;

-- CreateTable
CREATE TABLE "PatternStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "domain" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "totalAnswered" INTEGER NOT NULL DEFAULT 0,
    "totalCorrect" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PatternStats_sub_idx" ON "PatternStats"("sub");

-- CreateIndex
CREATE INDEX "PatternStats_updatedAt_idx" ON "PatternStats"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatternStats_domain_sub_pattern_key" ON "PatternStats"("domain", "sub", "pattern");
