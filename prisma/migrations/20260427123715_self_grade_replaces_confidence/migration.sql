/*
  Warnings:

  - You are about to drop the `PatternMiss` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `totalAnswered` on the `PatternStats` table. All the data in the column will be lost.
  - You are about to drop the column `totalCorrect` on the `PatternStats` table. All the data in the column will be lost.
  - You are about to drop the column `basket` on the `QuestionState` table. All the data in the column will be lost.
  - You are about to drop the column `correctInRow` on the `QuestionState` table. All the data in the column will be lost.
  - You are about to drop the column `encounters` on the `QuestionState` table. All the data in the column will be lost.
  - You are about to drop the column `leitnerBox` on the `QuestionState` table. All the data in the column will be lost.
  - You are about to drop the column `nextDueAt` on the `QuestionState` table. All the data in the column will be lost.
  - You are about to drop the column `confident` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedLevel` on the `SubStats` table. All the data in the column will be lost.
  - You are about to drop the column `overconfident` on the `SubStats` table. All the data in the column will be lost.
  - You are about to drop the column `recent` on the `SubStats` table. All the data in the column will be lost.
  - You are about to drop the column `totalAnswered` on the `SubStats` table. All the data in the column will be lost.
  - You are about to drop the column `totalCorrect` on the `SubStats` table. All the data in the column will be lost.
  - Added the required column `userId` to the `PatternStats` table without a default value. This is not possible if the table is not empty.
  - Added the required column `languageId` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `QuestionState` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `SubStats` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PatternMiss_sessionId_idx";

-- DropIndex
DROP INDEX "PatternMiss_pattern_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PatternMiss";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Language" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pinHash" TEXT,
    "languageId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PatternStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "lastSeenAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatternStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PatternStats" ("domain", "id", "lastSeenAt", "pattern", "sub", "updatedAt") SELECT "domain", "id", "lastSeenAt", "pattern", "sub", "updatedAt" FROM "PatternStats";
DROP TABLE "PatternStats";
ALTER TABLE "new_PatternStats" RENAME TO "PatternStats";
CREATE INDEX "PatternStats_userId_sub_idx" ON "PatternStats"("userId", "sub");
CREATE UNIQUE INDEX "PatternStats_userId_domain_sub_pattern_key" ON "PatternStats"("userId", "domain", "sub", "pattern");
CREATE TABLE "new_Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT NOT NULL,
    "languageId" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "pattern" TEXT NOT NULL,
    "counterpart" TEXT,
    "cueType" TEXT NOT NULL,
    "cue" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "register" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("correctIndex", "counterpart", "createdAt", "cue", "cueType", "domain", "explanation", "externalId", "id", "level", "options", "pattern", "register", "source", "sub") SELECT "correctIndex", "counterpart", "createdAt", "cue", "cueType", "domain", "explanation", "externalId", "id", "level", "options", "pattern", "register", "source", "sub" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_externalId_key" ON "Question"("externalId");
CREATE INDEX "Question_languageId_domain_sub_idx" ON "Question"("languageId", "domain", "sub");
CREATE INDEX "Question_languageId_pattern_idx" ON "Question"("languageId", "pattern");
CREATE INDEX "Question_languageId_level_idx" ON "Question"("languageId", "level");
CREATE INDEX "Question_languageId_domain_sub_level_idx" ON "Question"("languageId", "domain", "sub", "level");
CREATE TABLE "new_QuestionState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "stability" REAL NOT NULL DEFAULT 0,
    "difficulty" REAL NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastReview" DATETIME,
    "dueAt" DATETIME,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "firstServedAt" DATETIME,
    "lastSeenAt" DATETIME,
    CONSTRAINT "QuestionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionState_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_QuestionState" ("firstServedAt", "id", "lastSeenAt", "questionId", "retired") SELECT "firstServedAt", "id", "lastSeenAt", "questionId", "retired" FROM "QuestionState";
DROP TABLE "QuestionState";
ALTER TABLE "new_QuestionState" RENAME TO "QuestionState";
CREATE INDEX "QuestionState_userId_dueAt_idx" ON "QuestionState"("userId", "dueAt");
CREATE INDEX "QuestionState_userId_state_idx" ON "QuestionState"("userId", "state");
CREATE UNIQUE INDEX "QuestionState_userId_questionId_key" ON "QuestionState"("userId", "questionId");
CREATE TABLE "new_Review" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "correct" BOOLEAN NOT NULL,
    "selfGrade" TEXT,
    "responseMs" INTEGER NOT NULL,
    "speedTag" TEXT NOT NULL,
    "pointsEarned" REAL NOT NULL,
    "levelAtServe" INTEGER NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Review" ("correct", "id", "levelAtServe", "pointsEarned", "questionId", "responseMs", "reviewedAt", "sessionId", "speedTag") SELECT "correct", "id", "levelAtServe", "pointsEarned", "questionId", "responseMs", "reviewedAt", "sessionId", "speedTag" FROM "Review";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
CREATE INDEX "Review_userId_sessionId_idx" ON "Review"("userId", "sessionId");
CREATE INDEX "Review_userId_reviewedAt_idx" ON "Review"("userId", "reviewedAt");
CREATE TABLE "new_Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "domainFilter" TEXT,
    "plannedLength" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "endReason" TEXT,
    "questionsSeen" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "missCount" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "ppq" REAL NOT NULL DEFAULT 0,
    "bossDomain" TEXT,
    "bossLevel" INTEGER,
    "bossMedal" TEXT,
    "bossQueue" TEXT,
    "targetSubs" TEXT,
    "levelMin" INTEGER,
    "levelMax" INTEGER,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("bossDomain", "bossLevel", "bossMedal", "bossQueue", "correctCount", "domainFilter", "endReason", "endedAt", "id", "levelMax", "levelMin", "missCount", "mode", "plannedLength", "ppq", "questionsSeen", "startedAt", "targetSubs", "totalPoints") SELECT "bossDomain", "bossLevel", "bossMedal", "bossQueue", "correctCount", "domainFilter", "endReason", "endedAt", "id", "levelMax", "levelMin", "missCount", "mode", "plannedLength", "ppq", "questionsSeen", "startedAt", "targetSubs", "totalPoints" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE INDEX "Session_userId_startedAt_idx" ON "Session"("userId", "startedAt");
CREATE TABLE "new_SubStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SubStats" ("domain", "id", "isActive", "sub", "updatedAt") SELECT "domain", "id", "isActive", "sub", "updatedAt" FROM "SubStats";
DROP TABLE "SubStats";
ALTER TABLE "new_SubStats" RENAME TO "SubStats";
CREATE INDEX "SubStats_userId_domain_isActive_idx" ON "SubStats"("userId", "domain", "isActive");
CREATE UNIQUE INDEX "SubStats_userId_domain_sub_key" ON "SubStats"("userId", "domain", "sub");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_languageId_idx" ON "User"("languageId");
