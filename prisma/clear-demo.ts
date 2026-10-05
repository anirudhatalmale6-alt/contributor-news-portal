/**
 * Removes the demo users and everything they wrote, for the day the site opens
 * to real readers.
 *
 *   npm run demo:clear            # show what would go
 *   npm run demo:clear -- --yes   # actually delete it
 *
 * Only touches accounts on @thedocument.test, the addresses the seed creates.
 * Real accounts, real articles and the payment settings are left alone.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_DOMAIN = "@thedocument.test";

async function main() {
  const confirm = process.argv.includes("--yes");

  const users = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    select: { id: true, email: true, _count: { select: { articles: true } } },
  });

  if (users.length === 0) {
    console.log("No demo accounts found - nothing to do.");
    return;
  }

  const articles = users.reduce((n, u) => n + u._count.articles, 0);
  console.log(`Demo accounts: ${users.length}, articles by them: ${articles}`);
  users.forEach((u) => console.log(`  ${u.email} (${u._count.articles})`));

  if (!confirm) {
    console.log("\nNothing deleted. Re-run with --yes to remove them.");
    return;
  }

  // Articles, media, translations and reviews all cascade from the user row.
  const { count } = await prisma.user.deleteMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
  });
  console.log(`\nDeleted ${count} demo account(s) and everything attached to them.`);

  const left = await prisma.article.count();
  console.log(`Articles still in the database: ${left}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
