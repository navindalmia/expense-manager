/*
  Warnings:

  - You are about to drop the column `currency` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Group` table. All the data in the column will be lost.
  - Added the required column `currencyId` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currencyId` to the `Group` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "currency",
ADD COLUMN     "currencyId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "currency",
ADD COLUMN     "currencyId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- DropEnum
DROP TYPE "public"."Currency";

-- CreateTable
CREATE TABLE "Currency" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE INDEX "Expense_currencyId_idx" ON "Expense"("currencyId");

-- CreateIndex
CREATE INDEX "Group_currencyId_idx" ON "Group"("currencyId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
