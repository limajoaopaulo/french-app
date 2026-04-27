-- CreateTable
CREATE TABLE "Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QuestionState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "questionId" INTEGER NOT NULL,
    "encounters" INTEGER NOT NULL DEFAULT 0,
    "correctInRow" INTEGER NOT NULL DEFAULT 0,
    "basket" INTEGER NOT NULL DEFAULT 0,
    "leitnerBox" INTEGER NOT NULL DEFAULT 1,
    "nextDueAt" DATETIME,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "firstServedAt" DATETIME,
    "lastSeenAt" DATETIME,
    CONSTRAINT "QuestionState_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "questionId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "correct" BOOLEAN NOT NULL,
    "confident" BOOLEAN NOT NULL,
    "responseMs" INTEGER NOT NULL,
    "speedTag" TEXT NOT NULL,
    "pointsEarned" REAL NOT NULL,
    "levelAtServe" INTEGER NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "domain" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "estimatedLevel" REAL NOT NULL DEFAULT 3.0,
    "totalAnswered" INTEGER NOT NULL DEFAULT 0,
    "totalCorrect" INTEGER NOT NULL DEFAULT 0,
    "overconfident" INTEGER NOT NULL DEFAULT 0,
    "recent" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PatternMiss" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pattern" TEXT NOT NULL,
    "sessionId" INTEGER,
    "missedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "bossMedal" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Question_externalId_key" ON "Question"("externalId");

-- CreateIndex
CREATE INDEX "Question_domain_sub_idx" ON "Question"("domain", "sub");

-- CreateIndex
CREATE INDEX "Question_pattern_idx" ON "Question"("pattern");

-- CreateIndex
CREATE INDEX "Question_level_idx" ON "Question"("level");

-- CreateIndex
CREATE INDEX "Question_domain_sub_level_idx" ON "Question"("domain", "sub", "level");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionState_questionId_key" ON "QuestionState"("questionId");

-- CreateIndex
CREATE INDEX "QuestionState_nextDueAt_idx" ON "QuestionState"("nextDueAt");

-- CreateIndex
CREATE INDEX "QuestionState_basket_idx" ON "QuestionState"("basket");

-- CreateIndex
CREATE INDEX "Review_sessionId_idx" ON "Review"("sessionId");

-- CreateIndex
CREATE INDEX "Review_reviewedAt_idx" ON "Review"("reviewedAt");

-- CreateIndex
CREATE INDEX "SubStats_estimatedLevel_idx" ON "SubStats"("estimatedLevel");

-- CreateIndex
CREATE INDEX "SubStats_domain_isActive_idx" ON "SubStats"("domain", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubStats_domain_sub_key" ON "SubStats"("domain", "sub");

-- CreateIndex
CREATE INDEX "PatternMiss_pattern_idx" ON "PatternMiss"("pattern");

-- CreateIndex
CREATE INDEX "PatternMiss_sessionId_idx" ON "PatternMiss"("sessionId");

-- CreateIndex
CREATE INDEX "Session_startedAt_idx" ON "Session"("startedAt");
