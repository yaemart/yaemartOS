import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';
import { hash } from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const brands = [
  {
    id: 'homtone',
    name: 'Homtone',
    slug: 'homtone',
    themeColor: '#b45309',
    logoUrl: 'https://cdn.yaemartos.com/brands/homtone/logo.svg',
  },
  {
    id: 'spoonlemon',
    name: 'Spoonlemon',
    slug: 'spoonlemon',
    themeColor: '#059669',
    logoUrl: 'https://cdn.yaemartos.com/brands/spoonlemon/logo.svg',
  },
  {
    id: 'davivy',
    name: 'Davivy',
    slug: 'davivy',
    themeColor: '#7c3aed',
    logoUrl: 'https://cdn.yaemartos.com/brands/davivy/logo.svg',
  },
  {
    id: 'tysun',
    name: 'Tysun',
    slug: 'tysun',
    themeColor: '#0284c7',
    logoUrl: 'https://cdn.yaemartos.com/brands/tysun/logo.svg',
  },
];

async function main() {
  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { id: brand.id },
      create: brand,
      update: {
        name: brand.name,
        slug: brand.slug,
        themeColor: brand.themeColor,
        logoUrl: brand.logoUrl,
      },
    });
  }
  console.log('Seeded 4 brands successfully.');

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'davidgao@yaemart.org';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Gaowen2004';
  const passwordHash = await hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash,
      role: 'admin',
      brandId: 'homtone',
    },
    update: { passwordHash, role: 'admin' },
  });
  console.log(`Admin user ready: ${adminEmail}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
