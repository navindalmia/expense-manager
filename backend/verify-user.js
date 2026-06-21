const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verify() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'testtoken@example.com' },
      include: { verificationTokens: true },
    });

    console.log('\n✅ USER VERIFICATION STATUS:\n');
    console.log(`Email: ${user.email}`);
    console.log(`EmailVerified: ${user.emailVerified}`);
    console.log(`EmailVerifiedAt: ${user.emailVerifiedAt}`);
    console.log(`\nTokens in DB:`);
    user.verificationTokens.forEach(token => {
      console.log(`  - Token: ${token.token.slice(0, 20)}...`);
      console.log(`    Used: ${token.isUsed}`);
      console.log(`    Expires: ${token.expiresAt}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
