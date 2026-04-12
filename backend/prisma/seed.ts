import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  // -------------------- Currencies --------------------
  const currencies = [
    { code: "GBP", label: "British Pound" },
    { code: "USD", label: "US Dollar" },
    { code: "EUR", label: "Euro" },
    { code: "INR", label: "Indian Rupee" },
    { code: "AUD", label: "Australian Dollar" },
    { code: "CAD", label: "Canadian Dollar" },
    { code: "JPY", label: "Japanese Yen" },
    { code: "SGD", label: "Singapore Dollar" },
    { code: "HKD", label: "Hong Kong Dollar" },
    { code: "CHF", label: "Swiss Franc" },
    { code: "NZD", label: "New Zealand Dollar" },
    { code: "SEK", label: "Swedish Krona" },
  ];

  for (const curr of currencies) {
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
