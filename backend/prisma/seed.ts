import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { SEED_CURRENCIES } from "../src/lib/seedCurrencies";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  // -------------------- Currencies --------------------

  for (const curr of SEED_CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: curr.code },
      update: {},
      create: curr,
    });
  }

  // -------------------- Categories --------------------
  const categories = [
    { code: "FOOD", label: "Food" },
    { code: "ACCOMMODATION", label: "Accommodation" },
    { code: "TRAVEL", label: "Travel" },
    { code: "ENTERTAINMENT", label: "Entertainment" },
    { code: "SHOPPING", label: "Shopping" },
    { code: "UTILITIES", label: "Utilities" },
    { code: "OTHER", label: "Other" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { code: cat.code },
      update: {},
      create: cat,
    });
  }

  // -------------------- Users --------------------
  // Skip user seeding - let user create accounts via signup
  console.log("✅ Skipping user seeding - create via signup flow");

  console.log("✅ Database seeded successfully with currencies and categories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
