import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  // 1. Create platforms
  const platforms = [
    {
      name: 'Threads',
      slug: 'threads',
      isActive: true,
      config: {},
    },
    {
      name: 'Facebook',
      slug: 'facebook',
      isActive: true,
      config: {},
    },
    {
      name: 'Instagram',
      slug: 'instagram',
      isActive: true,
      config: {},
    },
    {
      name: 'TikTok',
      slug: 'tiktok',
      isActive: true,
      config: {},
    },
  ];

  for (const platform of platforms) {
    await prisma.platform.upsert({
      where: { slug: platform.slug },
      update: {},
      create: platform,
    });
    console.log(`Upserted platform: ${platform.name}`);
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
