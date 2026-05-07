-- AlterTable
ALTER TABLE "Session" ADD COLUMN "subLevelsBefore" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pinHash" TEXT,
    "languageId" INTEGER NOT NULL,
    "defaultDrillLength" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "displayName", "id", "languageId", "pinHash", "username") SELECT "createdAt", "displayName", "id", "languageId", "pinHash", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_username_idx" ON "User"("username");
CREATE INDEX "User_languageId_idx" ON "User"("languageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
