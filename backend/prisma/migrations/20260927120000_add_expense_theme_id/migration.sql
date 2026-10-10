-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "themeId" INTEGER;

-- CreateIndex
CREATE INDEX "Expense_themeId_idx" ON "Expense"("themeId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
