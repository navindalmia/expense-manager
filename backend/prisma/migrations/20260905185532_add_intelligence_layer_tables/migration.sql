-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "labelId" INTEGER;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "themeId" INTEGER;

-- CreateTable
CREATE TABLE "Theme" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategorySuggestionAudit" (
    "id" SERIAL NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "suggestedCategoryId" INTEGER NOT NULL,
    "acceptedCategoryId" INTEGER NOT NULL,
    "titleText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategorySuggestionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Theme_userId_idx" ON "Theme"("userId");

-- CreateIndex
CREATE INDEX "Label_userId_idx" ON "Label"("userId");

-- CreateIndex
CREATE INDEX "CategorySuggestionAudit_expenseId_idx" ON "CategorySuggestionAudit"("expenseId");

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX "Expense_labelId_idx" ON "Expense"("labelId");

-- CreateIndex
CREATE INDEX "Group_themeId_idx" ON "Group"("themeId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorySuggestionAudit" ADD CONSTRAINT "CategorySuggestionAudit_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorySuggestionAudit" ADD CONSTRAINT "CategorySuggestionAudit_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorySuggestionAudit" ADD CONSTRAINT "CategorySuggestionAudit_acceptedCategoryId_fkey" FOREIGN KEY ("acceptedCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE SET NULL ON UPDATE CASCADE;
