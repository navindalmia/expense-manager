const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  try {
    // Create or find test user
    const user = await prisma.user.upsert({
      where: { email: 'testtoken@example.com' },
      update: {},
      create: {
        email: 'testtoken@example.com',
        password: 'test-hash',
        emailVerified: false,
        name: 'Test User',
      },
    });

    console.log('User created/found:', user.id);

    // Generate token
    const token = `vrf_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create token in database
    const verificationToken = await prisma.emailVerificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    console.log('\n✅ REAL TEST TOKEN GENERATED:\n');
    console.log(`Token: ${token}`);
    console.log(`Expires at: ${expiresAt.toISOString()}`);
    console.log(`User ID: ${user.id}`);
    console.log(`\n📱 Test Link (paste in phone browser):`);
    console.log(`http://192.168.1.188:8081/verify-email?token=${token}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
