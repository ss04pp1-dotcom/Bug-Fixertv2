import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const EMAIL    = 'admin@streampro.com';
const PASSWORD = 'Admin@StreamPro2026';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  await prisma.$executeRawUnsafe(`
    INSERT INTO users (id, name, email, password_hash, role, is_active, email_verified, language, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Super Admin',
      '${EMAIL}',
      '${hash}',
      'super_admin'::user_role,
      true,
      true,
      'en',
      now(),
      now()
    )
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = 'super_admin'::user_role,
      is_active = true,
      deleted_at = NULL,
      updated_at = now()
  `);

  console.log('✅ Admin user created / updated.');
  console.log(`📧 Email:    ${EMAIL}`);
  console.log(`🔑 Password: ${PASSWORD}`);
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
