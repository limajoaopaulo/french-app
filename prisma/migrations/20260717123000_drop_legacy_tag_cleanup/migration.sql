-- DropIndex
DROP INDEX "PatternStats_userId_domain_sub_pattern_key";
DROP INDEX "PatternStats_userId_sub_idx";
DROP INDEX "SubStats_userId_domain_sub_key";
DROP INDEX "SubStats_userId_domain_isActive_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PatternStats";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SubStats";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT NOT NULL,
    "languageId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "cue" TEXT NOT NULL,
    "blankHint" TEXT,
    "translation" TEXT,
    "options" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "register" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Copy cueType -> format so existing rows keep their format value.
INSERT INTO "new_Question" ("id", "externalId", "languageId", "level", "format", "cue", "blankHint", "translation", "options", "correctIndex", "explanation", "register", "source", "createdAt")
SELECT "id", "externalId", "languageId", "level", "cueType", "cue", "blankHint", "translation", "options", "correctIndex", "explanation", "register", "source", "createdAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_externalId_key" ON "Question"("externalId");
CREATE INDEX "Question_languageId_level_idx" ON "Question"("languageId", "level");

CREATE TABLE "new_Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "plannedLength" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "endReason" TEXT,
    "questionsSeen" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "missCount" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "ppq" REAL NOT NULL DEFAULT 0,
    "targetTags" TEXT,
    "levelMin" INTEGER,
    "levelMax" INTEGER,
    "subLevelsBefore" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Copy targetSubs -> targetTags (same JSON, renamed column).
INSERT INTO "new_Session" ("id", "userId", "mode", "plannedLength", "startedAt", "endedAt", "endReason", "questionsSeen", "correctCount", "missCount", "totalPoints", "ppq", "targetTags", "levelMin", "levelMax", "subLevelsBefore")
SELECT "id", "userId", "mode", "plannedLength", "startedAt", "endedAt", "endReason", "questionsSeen", "correctCount", "missCount", "totalPoints", "ppq", "targetSubs", "levelMin", "levelMax", "subLevelsBefore" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE INDEX "Session_userId_startedAt_idx" ON "Session"("userId", "startedAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
