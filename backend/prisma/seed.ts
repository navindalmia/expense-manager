import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
  const users = [
    { name: "Alice", email: "alice@example.com" },
    { name: "Bob", email: "bob@example.com" },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }

  // -------------------- Groups --------------------
  const group = await prisma.group.create({
    data: {
      name: "Team Dinner",
      description: "Team bonding dinner",
      createdBy: { connect: { email: "alice@example.com" } },
      members: {
        connect: [
          { email: "alice@example.com" },
          { email: "bob@example.com" },
        ],
      },
      currency: "GBP",
    },
  });

  // -------------------- Sample Expense --------------------
  await prisma.expense.create({
    data: {
      title: "Team Lunch",
      amount: 100,
      paidBy: { connect: { email: "alice@example.com" } },
      group: { connect: { id: group.id } },
      splitWith: {
        connect: [
          { email: "alice@example.com" },
          { email: "bob@example.com" },
        ],
      },
      splitType: "EQUAL",
      splitAmount: [],        // empty because equal split
      splitPercentage: [],    // empty because equal split
      category: { connect: { code: "FOOD" } },
      currency: "GBP",
      expenseDate: new Date("2025-09-29"),
      notes: "Pizza and drinks",
    },
  });

  console.log("✅ Database seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
