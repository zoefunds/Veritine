// Minimal, idempotent seed data for local development. Safe to rerun -
// uses upsert throughout. Run with: pnpm --filter @veritine/api db:seed

import { PrismaClient, DisputeCategory, DisputeStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const demoUser = await prisma.user.upsert({
    where: { primaryWalletAddress: '0x0000000000000000000000000000000000dEaD' },
    update: {},
    create: {
      primaryWalletAddress: '0x0000000000000000000000000000000000dEaD',
      displayName: 'Veritine Demo Account',
      wallets: {
        create: {
          address: '0x0000000000000000000000000000000000dEaD',
          chainId: 'genlayer-studionet',
          verifiedAt: new Date(),
        },
      },
    },
  });

  const existingDispute = await prisma.dispute.findFirst({
    where: { question: 'Did the demo sustainability report overstate emissions cuts?' },
  });

  if (!existingDispute) {
    await prisma.dispute.create({
      data: {
        question: 'Did the demo sustainability report overstate emissions cuts?',
        description: 'Seed dispute used to exercise the local development environment.',
        category: DisputeCategory.CLIMATE,
        creatorUserId: demoUser.id,
        status: DisputeStatus.DRAFT,
        participationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        evidenceDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        minPositionStakeWei: '1000000000000000000',
        minEvidenceStakeWei: '500000000000000000',
        positions: {
          create: [{ label: 'Yes, materially overstated' }, { label: 'No, accurately reported' }],
        },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
