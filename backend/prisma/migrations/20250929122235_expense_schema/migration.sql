-- CreateEnum
CREATE TYPE "public"."Currency" AS ENUM ('GBP', 'INR', 'USD', 'EUR', 'AUD', 'CAD', 'JPY', 'CNY', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SplitType" AS ENUM ('EQUAL', 'AMOUNT', 'PERCENTAGE');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Expense" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" "public"."Currency" NOT NULL DEFAULT 'GBP',
    "paidById" INTEGER NOT NULL,
    "splitAmount" DOUBLE PRECISION[],
    "splitPercentage" DOUBLE PRECISION[],
    "splitType" "public"."SplitType" NOT NULL DEFAULT 'EQUAL',
    "categoryId" INTEGER NOT NULL,
    "notes" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ExpenseToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ExpenseToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "public"."Category"("code");

-- CreateIndex
CREATE INDEX "_ExpenseToUser_B_index" ON "public"."_ExpenseToUser"("B");

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ExpenseToUser" ADD CONSTRAINT "_ExpenseToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ExpenseToUser" ADD CONSTRAINT "_ExpenseToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
