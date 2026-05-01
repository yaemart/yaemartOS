import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

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
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
