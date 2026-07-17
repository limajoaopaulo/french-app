-- AlterTable
ALTER TABLE "Question" ADD COLUMN "blankHint" TEXT;
ALTER TABLE "Question" ADD COLUMN "translation" TEXT;

-- CreateTable
CREATE TABLE "QuestionTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "questionId" INTEGER NOT NULL,
    "facet" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    CONSTRAINT "QuestionTag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TagStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "facet" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "lastSeenAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TagStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QuestionTag_facet_tag_role_idx" ON "QuestionTag"("facet", "tag", "role");

-- CreateIndex
CREATE INDEX "QuestionTag_facet_tag_idx" ON "QuestionTag"("facet", "tag");

-- CreateIndex
CREATE INDEX "QuestionTag_questionId_idx" ON "QuestionTag"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTag_questionId_facet_tag_key" ON "QuestionTag"("questionId", "facet", "tag");

-- CreateIndex
CREATE INDEX "TagStats_userId_facet_idx" ON "TagStats"("userId", "facet");

-- CreateIndex
CREATE UNIQUE INDEX "TagStats_userId_facet_tag_key" ON "TagStats"("userId", "facet", "tag");
