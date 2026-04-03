import prisma from './src/lib/prisma';

async function main() {
  console.log('\n========== DATABASE CHECK ==========\n');

  // Show one expense to see actual structure
  const sampleExpense = await prisma.expense.findFirst();
  console.log('📋 EXPENSE STRUCTURE (sample):');
  if (sampleExpense) {
    console.log(JSON.stringify(sampleExpense, null, 2));
  } else {
    console.log('No expenses found');
  }

  // Users
  const users = await prisma.user.findMany();
  console.log('👥 USERS:', users.length);
  console.table(users);

  // Groups
  const groups = await prisma.group.findMany({ include: { members: true, createdBy: true } });
  console.log('\n📊 GROUPS:', groups.length);
  groups.forEach((g: any) => {
    console.log(`  • ${g.name} (ID: ${g.id})`);
    console.log(`    Created by: ${g.createdBy.name}`);
    console.log(`    Members: ${g.members.map((m: any) => m.name).join(', ')}`);
    console.log(`    Currency: ${g.currency}`);
  });

  // Categories
  const categories = await prisma.category.findMany();
  console.log('\n🏷️  CATEGORIES:', categories.length);
  console.table(categories);

  // Expenses
  const expenses = await prisma.expense.findMany({ 
    include: { 
      paidBy: true, 
      group: true, 
      category: true,
      splitWith: true 
    } 
  });
  console.log('\n💰 EXPENSES:', expenses.length);
  expenses.forEach((e: any) => {
    console.log(`  • ${e.title} - $${e.amount} ${e.currency}`);
    console.log(`    Group: ${e.group.name}`);
    console.log(`    Paid by: ${e.paidBy.name}`);
    console.log(`    Split with: ${e.splitWith.map((u: any) => u.name).join(', ') || 'Nobody'}`);
  });

  console.log('\n✅ Database check complete!\n');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
