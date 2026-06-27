import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@streampro.com';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!PASSWORD) {
  console.error('❌ SEED_ADMIN_PASSWORD env var is required. Set it before running this script.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  await prisma.user.upsert({
    where:  { email: EMAIL },
    update: { passwordHash: hash, role: 'super_admin', isActive: true, deletedAt: null },
    create: {
      name: 'Super Admin',
      email: EMAIL,
      passwordHash: hash,
      role: 'super_admin',
      isActive: true,
      emailVerified: true,
      language: 'en',
    },
  });

  console.log('✅ Admin user created / updated.');
  console.log(`📧 Email: ${EMAIL}`);
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
