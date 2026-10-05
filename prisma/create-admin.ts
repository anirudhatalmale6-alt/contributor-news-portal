/**
 * Creates (or promotes) the real Admin account, so the owner is not left using
 * a demo login.
 *
 *   npm run admin:create -- "you@example.com" "Your Name" "a-good-password"
 *
 * Re-running it on the same email updates the name, password and role rather
 * than erroring, which makes it safe to use as a password reset too.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, name, password] = process.argv.slice(2);

  if (!email || !name || !password) {
    console.error('Usage: npm run admin:create -- "email" "Full Name" "password"');
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`"${email}" does not look like an email address.`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Use a password of at least 8 characters.");
    process.exit(1);
  }

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      name,
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 11),
    },
    update: {
      name,
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 11),
    },
    select: { id: true, email: true, name: true, role: true },
  });

  console.log(`Admin ready: ${user.name} <${user.email}>`);
  console.log("Sign in at /login, then the Newsroom and Admin screens are yours.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
