import { config } from "dotenv";
import { createRequire } from "module";

config({ path: ".env.local" });

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");
const bcrypt = require("bcryptjs");

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const EMAIL    = "office@spokadmin.ro";
const PASSWORD = "Sonyk750/-";
const NAME     = "Octav Ene";
const ORG_NAME = "SpokAdmin";
const ORG_SLUG = "spokadmin";

async function main() {
  // Sterg cont existent dacă există (re-seed)
  const existing = await db.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log("Cont existent găsit — șterg și recreez...");
    await db.user.delete({ where: { email: EMAIL } });
  }

  const existingOrg = await db.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (existingOrg) {
    await db.organization.delete({ where: { slug: ORG_SLUG } });
  }

  const hashed = await bcrypt.hash(PASSWORD, 12);

  const user = await db.user.create({
    data: {
      name:     NAME,
      email:    EMAIL,
      password: hashed,
      role:     "ADMIN",
      isActive: true,
    },
  });

  const org = await db.organization.create({
    data: {
      name:   ORG_NAME,
      slug:   ORG_SLUG,
      plan:   "enterprise",
      status: "active",
    },
  });

  await db.organizationMember.create({
    data: {
      userId:         user.id,
      organizationId: org.id,
      role:           "OWNER",
    },
  });

  console.log("\n✅ Cont admin creat cu succes!\n");
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Parolă:   ${PASSWORD}`);
  console.log(`   Rol:      ADMIN / OWNER`);
  console.log(`   Firmă:    ${ORG_NAME}\n`);
}

main()
  .catch(e => { console.error("❌ Eroare:", e.message); process.exit(1); })
  .finally(() => db.$disconnect());
