import prisma from './src/lib/prisma';

async function check() {
  try {
    const currencies = await prisma.currency.findMany();
    const categories = await prisma.category.findMany();
    const users = await prisma.user.findMany();
    
    console.log('Currencies:', currencies.length);
    console.log('Categories:', categories.length);
    console.log('Users:', users.length);
    
    if (categories.length > 0) {
      console.log('\nCategories:');
      categories.forEach(c => console.log(`  - ${c.code}: ${c.label}`));
    } else {
      console.log('\n⚠️ No categories found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
