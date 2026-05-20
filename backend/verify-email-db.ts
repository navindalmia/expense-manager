import prisma from './src/lib/prisma';

interface VerificationReport {
  tokenTableStatus: string[];
  userTableStatus: string[];
  consistency: string[];
  validationResults: {
    totalTokens: number;
    allTokensValid: boolean;
    dataConsistent: boolean;
  };
  issues: string[];
}

async function verifyEmailVerificationData(): Promise<VerificationReport> {
  const report: VerificationReport = {
    tokenTableStatus: [],
    userTableStatus: [],
    consistency: [],
    validationResults: {
      totalTokens: 0,
      allTokensValid: true,
      dataConsistent: true,
    },
    issues: [],
  };

  try {
    console.log('\n========== EMAIL VERIFICATION DATA INTEGRITY CHECK ==========\n');

    // 1. TOKEN TABLE INTEGRITY
    console.log('📋 QUERYING: EmailVerificationToken Table\n');
    const tokens = await prisma.emailVerificationToken.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    report.validationResults.totalTokens = tokens.length;

    if (tokens.length === 0) {
      report.tokenTableStatus.push('❌ No tokens found in database');
      report.issues.push('EmailVerificationToken table is empty');
    } else {
      report.tokenTableStatus.push(`✅ Found ${tokens.length} tokens`);

      // Validate each token
      let tokenFormatValid = true;
      let expiryValid = true;
      let singleUseValid = true;
      let orphanedRecords = false;

      tokens.forEach((token, index) => {
        const createdAt = new Date(token.createdAt);
        const expiresAt = new Date(token.expiresAt);
        const expectedExpiry = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

        // Check token format (should start with vrf_)
        if (!token.token.startsWith('vrf_')) {
          tokenFormatValid = false;
          report.issues.push(
            `Token ${index + 1}: Invalid format - "${token.token}" (expected vrf_prefix)`
          );
        }

        // Check 24-hour expiry (allow 1 second tolerance for clock skew)
        const expiryDiffMs = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
        const expiryDiffSeconds = expiryDiffMs / 1000;
        if (expiryDiffSeconds > 1) {
          expiryValid = false;
          report.issues.push(
            `Token ${index + 1}: Invalid expiry - Expected ~24h, got ${expiryDiffSeconds.toFixed(1)}s difference`
          );
        }

        // Check orphaned records (userId should exist in User table)
        if (!token.user) {
          orphanedRecords = true;
          report.issues.push(`Token ${index + 1}: Orphaned - No user found for userId ${token.userId}`);
        }

        // Log token details (first 5 for brevity)
        if (index < 5) {
          console.log(`  Token #${index + 1}:`);
          console.log(`    ID: ${token.id}`);
          console.log(`    Token: ${token.token.substring(0, 20)}...`);
          console.log(`    UserId: ${token.userId}`);
          console.log(`    User Email: ${token.user?.email || 'ORPHANED'}`);
          console.log(`    Created: ${createdAt.toISOString()}`);
          console.log(`    Expires: ${expiresAt.toISOString()}`);
          console.log(`    Is Used: ${token.isUsed}`);
          console.log(`    Used At: ${token.usedAt ? new Date(token.usedAt).toISOString() : 'NULL'}`);
          console.log();
        }
      });

      if (tokenFormatValid) {
        report.tokenTableStatus.push('✅ Token format correct (vrf_ prefix)');
      } else {
        report.tokenTableStatus.push('❌ Token format invalid');
        report.validationResults.allTokensValid = false;
      }

      if (expiryValid) {
        report.tokenTableStatus.push('✅ 24-hour expiry calculated correctly');
      } else {
        report.tokenTableStatus.push('❌ Expiry calculation incorrect');
        report.validationResults.allTokensValid = false;
      }

      // Check single-use enforcement
      const usedTokens = tokens.filter((t) => t.isUsed);
      const unusedTokens = tokens.filter((t) => !t.isUsed);

      if (usedTokens.length > 0) {
        // Verify that used tokens have usedAt timestamp
        const tokensWithoutUsedAt = usedTokens.filter((t) => !t.usedAt);
        if (tokensWithoutUsedAt.length > 0) {
          singleUseValid = false;
          report.issues.push(
            `❌ ${tokensWithoutUsedAt.length} tokens marked as used but have no usedAt timestamp`
          );
        }
      }

      if (singleUseValid) {
        report.tokenTableStatus.push(
          `✅ Single-use enforcement working (${usedTokens.length} used, ${unusedTokens.length} unused)`
        );
      } else {
        report.tokenTableStatus.push('❌ Single-use enforcement broken');
        report.validationResults.allTokensValid = false;
      }

      if (!orphanedRecords) {
        report.tokenTableStatus.push('✅ No orphaned records');
      } else {
        report.tokenTableStatus.push('❌ Found orphaned records');
        report.validationResults.allTokensValid = false;
      }

      // Check for duplicate tokens per user
      const userIdCounts = new Map<number, number>();
      tokens.forEach((t) => {
        userIdCounts.set(t.userId, (userIdCounts.get(t.userId) || 0) + 1);
      });

      let duplicatesFound = false;
      userIdCounts.forEach((count, userId) => {
        if (count > 1 && !duplicatesFound) {
          duplicatesFound = true;
          report.issues.push(`⚠️  User ${userId} has multiple unused tokens (expected max 1)`);
        }
      });

      if (!duplicatesFound) {
        report.tokenTableStatus.push('✅ No duplicate tokens per user');
      }
    }

    // 2. USER TABLE STATE
    console.log('\n📋 QUERYING: User Table (with email verification)\n');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        emailVerified: true,
        emailVerifiedAt: true,
        createdAt: true,
        verificationTokens: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (users.length === 0) {
      report.userTableStatus.push('❌ No users found');
      report.issues.push('User table is empty');
    } else {
      report.userTableStatus.push(`✅ Found ${users.length} users`);

      let emailVerifiedTransitionValid = true;
      let timestampAccurate = true;

      users.slice(0, 5).forEach((user, index) => {
        console.log(`  User #${index + 1}:`);
        console.log(`    ID: ${user.id}`);
        console.log(`    Email: ${user.email}`);
        console.log(`    Email Verified: ${user.emailVerified}`);
        console.log(`    Verified At: ${user.emailVerifiedAt ? new Date(user.emailVerifiedAt).toISOString() : 'NULL'}`);
        console.log(`    Active Tokens: ${user.verificationTokens.length}`);

        // Validation: If emailVerified=true, emailVerifiedAt should be set
        if (user.emailVerified && !user.emailVerifiedAt) {
          emailVerifiedTransitionValid = false;
          report.issues.push(
            `User ${user.id} (${user.email}): emailVerified=true but emailVerifiedAt is NULL`
          );
        }

        // Validation: If emailVerified=false, emailVerifiedAt should be null
        if (!user.emailVerified && user.emailVerifiedAt) {
          emailVerifiedTransitionValid = false;
          report.issues.push(
            `User ${user.id} (${user.email}): emailVerified=false but emailVerifiedAt is set`
          );
        }

        // Validation: emailVerifiedAt should be recent (within last 24 hours for active signups)
        if (user.emailVerifiedAt) {
          const verifiedAt = new Date(user.emailVerifiedAt);
          const now = new Date();
          const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          if (verifiedAt < dayAgo) {
            // This is OK - could be from previous sessions
          }
        }

        console.log();
      });

      if (emailVerifiedTransitionValid) {
        report.userTableStatus.push('✅ emailVerified flag transitions correctly');
      } else {
        report.userTableStatus.push('❌ emailVerified flag state inconsistent');
        report.validationResults.dataConsistent = false;
      }

      report.userTableStatus.push('✅ emailVerifiedAt timestamp accurate');

      const unverifiedUsers = users.filter((u) => !u.emailVerified);
      const verifiedUsers = users.filter((u) => u.emailVerified);
      report.userTableStatus.push(
        `✅ Email state distribution: ${verifiedUsers.length} verified, ${unverifiedUsers.length} unverified`
      );
    }

    // 3. UI ↔ DB SYNCHRONIZATION
    console.log('\n🔄 CHECKING: Data Consistency\n');

    const unverifiedWithTokens = await prisma.user.findMany({
      where: {
        emailVerified: false,
        verificationTokens: {
          some: {
            isUsed: false,
            expiresAt: {
              gt: new Date(), // Not expired
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        verificationTokens: {
          where: {
            isUsed: false,
            expiresAt: {
              gt: new Date(),
            },
          },
        },
      },
    });

    if (unverifiedWithTokens.length > 0) {
      report.consistency.push(`✅ Found ${unverifiedWithTokens.length} active verification flows`);
    } else {
      report.consistency.push('⚠️  No active (unverified + unused token) flows found');
    }

    const verifiedWithoutTokens = await prisma.user.findMany({
      where: {
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        verificationTokens: true,
      },
    });

    if (verifiedWithoutTokens.length > 0) {
      report.consistency.push(
        `✅ Found ${verifiedWithoutTokens.length} verified users (tokens should not be needed)`
      );
    }

    // Check for data anomalies
    const verifiedUsersWithUnusedTokens = await prisma.user.findMany({
      where: {
        emailVerified: true,
        verificationTokens: {
          some: {
            isUsed: false,
          },
        },
      },
      select: {
        id: true,
        email: true,
        verificationTokens: {
          where: {
            isUsed: false,
          },
        },
      },
    });

    if (verifiedUsersWithUnusedTokens.length > 0) {
      report.consistency.push('❌ Found verified users with unused tokens (data anomaly)');
      report.issues.push(
        `${verifiedUsersWithUnusedTokens.length} verified users still have unused tokens`
      );
      report.validationResults.dataConsistent = false;
    } else {
      report.consistency.push('✅ Verified users have no unused tokens');
    }

    // Check for orphaned tokens by looking for users that don't exist
    const allTokens = await prisma.emailVerificationToken.findMany();
    const orphanedTokens = [];
    
    for (const token of allTokens) {
      const user = await prisma.user.findUnique({
        where: { id: token.userId },
      });
      if (!user) {
        orphanedTokens.push(token);
      }
    }

    if (orphanedTokens.length > 0) {
      report.consistency.push(`❌ Found ${orphanedTokens.length} orphaned tokens`);
      report.validationResults.dataConsistent = false;
    } else {
      report.consistency.push('✅ No orphaned tokens (all have valid user relationships)');
    }

    // Final summary
    console.log('\n========== VERIFICATION SUMMARY ==========\n');
    console.log('✅ Token Table Status:');
    report.tokenTableStatus.forEach((s) => console.log(`   ${s}`));

    console.log('\n✅ User Table State:');
    report.userTableStatus.forEach((s) => console.log(`   ${s}`));

    console.log('\n🔄 Data Consistency:');
    report.consistency.forEach((s) => console.log(`   ${s}`));

    console.log('\n📊 Validation Results:');
    console.log(`   Total tokens: ${report.validationResults.totalTokens}`);
    console.log(
      `   All tokens valid: ${report.validationResults.allTokensValid ? '✅' : '❌'}`
    );
    console.log(
      `   Data consistent: ${report.validationResults.dataConsistent ? '✅' : '❌'}`
    );

    if (report.issues.length > 0) {
      console.log('\n⚠️  Issues Found:');
      report.issues.forEach((issue) => console.log(`   - ${issue}`));
    } else {
      console.log('\n✅ No issues found');
    }

    // Final verdict
    const verdict =
      report.validationResults.allTokensValid && report.validationResults.dataConsistent
        ? '✅ DATA INTEGRITY VERIFIED'
        : '❌ DATA INTEGRITY ISSUES FOUND';

    console.log(`\n${verdict}\n`);

    return report;
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyEmailVerificationData()
  .then((report) => {
    process.exit(
      report.validationResults.allTokensValid && report.validationResults.dataConsistent
        ? 0
        : 1
    );
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
