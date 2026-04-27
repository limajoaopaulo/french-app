-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SubStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "domain" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "estimatedLevel" REAL NOT NULL DEFAULT 2.0,
    "totalAnswered" INTEGER NOT NULL DEFAULT 0,
    "totalCorrect" INTEGER NOT NULL DEFAULT 0,
    "overconfident" INTEGER NOT NULL DEFAULT 0,
    "recent" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SubStats" ("domain", "estimatedLevel", "id", "isActive", "overconfident", "recent", "sub", "totalAnswered", "totalCorrect", "updatedAt") SELECT "domain", "estimatedLevel", "id", "isActive", "overconfident", "recent", "sub", "totalAnswered", "totalCorrect", "updatedAt" FROM "SubStats";
DROP TABLE "SubStats";
ALTER TABLE "new_SubStats" RENAME TO "SubStats";
CREATE INDEX "SubStats_estimatedLevel_idx" ON "SubStats"("estimatedLevel");
CREATE INDEX "SubStats_domain_isActive_idx" ON "SubStats"("domain", "isActive");
CREATE UNIQUE INDEX "SubStats_domain_sub_key" ON "SubStats"("domain", "sub");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
