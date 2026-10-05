/**
 * Demo data: four roles, articles sitting in every stage of the workflow, and
 * payouts already assigned so the earnings panel has something to show.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "demo1234";

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 11);

  const [admin, editor, maya, sam, leo] = await Promise.all([
    upsertUser("admin@dispatch.test", "Nadia Okoro", "ADMIN", "GENERAL", hash, "Runs the desk."),
    upsertUser(
      "editor@dispatch.test",
      "Tom Beckett",
      "EDITOR",
      "GENERAL",
      hash,
      "Night editor. Twelve years on the city beat.",
    ),
    upsertUser(
      "maya@dispatch.test",
      "Maya Iyer",
      "CONTRIBUTOR",
      "VERIFIED",
      hash,
      "Transport and infrastructure. Verified contributor since 2024.",
    ),
    upsertUser(
      "sam@dispatch.test",
      "Sam Whitfield",
      "CONTRIBUTOR",
      "GENERAL",
      hash,
      "Writes about small business and local trade.",
    ),
    upsertUser(
      "leo@dispatch.test",
      "Leo Fontaine",
      "CONTRIBUTOR",
      "GENERAL",
      hash,
      "Culture, music and everything loud.",
    ),
  ]);

  await prisma.paymentSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000);

  const articles = [
    {
      slug: "the-night-bus-that-never-came",
      title: "The night bus that never came",
      dek: "Three months of cancelled late services, and the operator still calls it a staffing blip.",
      category: "Politics",
      cover: "/uploads/seed/transit.jpg",
      author: maya,
      status: "APPROVED" as const,
      payout: 14500,
      published: hoursAgo(5),
      body: `The last bus out of the depot on a Friday is supposed to leave at 00:41. For eleven of the last thirteen Fridays, it has not left at all.

## What the data shows
The operator publishes cancellations as a monthly percentage. Pulled apart by hour, the picture changes: services after midnight are cancelled at nine times the rate of the morning peak.

> "We are told it is a staffing blip. A blip does not last a quarter."

Drivers describe a rota that depends on overtime nobody wants to take. Two of them, speaking on condition of anonymity because they are not authorised to talk to the press, said the late shift has been running two drivers short since the spring.

## Who is left waiting
- Hospital staff finishing the evening shift
- Hospitality workers with no night tariff on the taxi rank
- Students on the far side of the ring road

The council says it is "monitoring performance closely". The contract allows a penalty of up to four percent of the annual subsidy. It has never been applied.`,
      media: [{ kind: "IMAGE" as const, url: "/uploads/seed/transit.jpg", caption: "The depot at 00:50." }],
    },
    {
      slug: "the-corner-shop-that-outlived-the-chain",
      title: "The corner shop that outlived the chain",
      dek: "A supermarket opened across the road in 2019. The shop that was supposed to die is hiring.",
      category: "Business",
      cover: "/uploads/seed/business.jpg",
      author: sam,
      status: "APPROVED" as const,
      payout: 9000,
      published: hoursAgo(26),
      body: `When the chain store opened opposite, everyone told Farida to sell up.

Six years later the chain has cut its opening hours twice and she has put on two members of staff.

## Margins, not footfall
Farida's answer is unglamorous: she stopped competing on the forty products the chain sells cheapest, and doubled the range on everything it does not stock at all.

> "They can beat me on milk. They cannot beat me on knowing that Mrs Owusu wants her bread on Thursday."

The shop now runs a delivery round of eighty-one households. None of it is online. All of it is written in a notebook behind the till.`,
      media: [{ kind: "IMAGE" as const, url: "/uploads/seed/business.jpg", caption: null }],
    },
    {
      slug: "a-field-recording-of-a-city-waking-up",
      title: "A field recording of a city waking up",
      dek: "One microphone, one roof, ninety consecutive mornings.",
      category: "Culture",
      cover: "/uploads/seed/culture.jpg",
      author: leo,
      status: "APPROVED" as const,
      payout: 6500,
      published: hoursAgo(50),
      body: `The first sound is almost always a shutter going up.

For ninety mornings a sound artist set a microphone on the same flat roof and recorded the hour either side of sunrise. The result is a document of a city's routine, and of the days it broke.

## What changes, what does not
Gulls arrive at the same minute in August and in November. Traffic moves by forty minutes across the same period. On the morning of the strike, the recording is almost silent for eleven minutes.`,
      media: [{ kind: "IMAGE" as const, url: "/uploads/seed/culture.jpg", caption: null }],
    },
    {
      slug: "the-heat-pump-waiting-list",
      title: "The heat pump waiting list nobody is auditing",
      dek: "A grant scheme with a nine-month queue, and no published figure for how many give up.",
      category: "Technology",
      cover: "/uploads/seed/climate.jpg",
      author: maya,
      status: "APPROVED" as const,
      payout: 0,
      published: hoursAgo(2),
      body: `The grant exists. The installers exist. The queue between them is where the scheme quietly fails.

## Nine months, on average
Of 212 households surveyed, the median wait between application and installation was 38 weeks. Twenty-nine withdrew before an installer ever visited.

The department publishes applications and completions. It does not publish withdrawals, which means the only number that would show the scheme leaking is the one nobody collects.`,
      media: [{ kind: "IMAGE" as const, url: "/uploads/seed/climate.jpg", caption: null }],
    },
    {
      slug: "inside-the-permit-office-backlog",
      title: "Inside the permit office backlog",
      dek: "Twenty-two thousand applications, one scanner, and a rule that says paper only.",
      category: "Politics",
      cover: "/uploads/seed/politics.jpg",
      author: sam,
      status: "SUBMITTED" as const,
      payout: 0,
      submitted: hoursAgo(3),
      body: `The office takes applications on paper because the regulation that created it, written in 1998, says the form must bear a wet signature.

## The scanner
There is one. It processes roughly 300 pages a day. The incoming post averages 1,100.

Staff have asked four times for the rule to be amended. The department's own impact note, obtained through a records request, puts the cost of the change at under twelve thousand pounds and the saving at nine staff posts a year.

> "We are not short of will. We are short of a sentence being rewritten."`,
      media: [{ kind: "IMAGE" as const, url: "/uploads/seed/politics.jpg", caption: "Trolleys of unopened post." }],
    },
    {
      slug: "the-model-that-priced-the-river",
      title: "The model that priced the river",
      dek: "A flood model built for insurers is now setting planning policy. Its authors never intended that.",
      category: "Technology",
      cover: "/uploads/seed/tech.jpg",
      author: leo,
      status: "SUBMITTED" as const,
      payout: 0,
      submitted: hoursAgo(1),
      body: `The model was commissioned to price risk, not to decide where houses go.

## Two different questions
An insurer wants to know the expected annual loss across a portfolio. A planning committee wants to know whether this specific field floods. The model answers the first question well and the second one badly, and it is now cited in both.

Its lead author, now retired, was blunt: the resolution was never meant to support a site-by-site decision.`,
      media: [],
    },
    {
      slug: "untitled-draft-market-rents",
      title: "Market rents: what the listings do not say",
      dek: "",
      category: "Business",
      cover: null,
      author: maya,
      status: "DRAFT" as const,
      payout: 0,
      body: `Notes so far - advertised rent vs agreed rent across 400 listings. Need to pull the registry figures before this is worth anything.

Still to do: speak to two letting agents, get the registry extract, check whether the gap holds outside the city centre.`,
      media: [],
    },
    {
      slug: "the-festival-that-ran-out-of-money",
      title: "The festival that ran out of money twice",
      dek: "Two collapses, one committee, and a council loan that was never going to be repaid.",
      category: "Culture",
      cover: null,
      author: leo,
      status: "REJECTED" as const,
      payout: 0,
      body: `The festival folded in 2019 and again last summer. The same four names sat on the organising committee both times.

The council advanced a loan of sixty thousand in the spring. The accounts filed a month later showed liabilities already past that figure.`,
      media: [],
      rejection:
        "Strong story but I cannot run it on the accounts alone - we need a right of reply from the committee chair and the exact loan terms from the council. Add both and resubmit, I will hold the slot.",
    },
  ];

  for (const a of articles) {
    const existing = await prisma.article.findUnique({ where: { slug: a.slug } });
    if (existing) {
      await prisma.article.delete({ where: { slug: a.slug } });
    }

    const created = await prisma.article.create({
      data: {
        slug: a.slug,
        title: a.title,
        dek: a.dek || null,
        body: a.body,
        category: a.category,
        coverImage: a.cover,
        status: a.status,
        authorId: a.author.id,
        payoutCents: a.payout,
        reviewerId: a.status === "APPROVED" || a.status === "REJECTED" ? editor.id : null,
        submittedAt:
          "submitted" in a && a.submitted
            ? a.submitted
            : a.status === "APPROVED"
              ? hoursAgo(72)
              : null,
        publishedAt: "published" in a ? (a.published as Date) : null,
        media: { create: a.media },
      },
    });

    // Audit trail that matches the state each piece is in.
    if (a.status !== "DRAFT") {
      await prisma.review.create({
        data: {
          articleId: created.id,
          action: "SUBMITTED",
          fromStatus: "DRAFT",
          toStatus: "SUBMITTED",
          createdAt: created.submittedAt ?? hoursAgo(80),
        },
      });
    }
    if (a.status === "APPROVED") {
      await prisma.review.create({
        data: {
          articleId: created.id,
          editorId: editor.id,
          action: "APPROVED",
          fromStatus: "SUBMITTED",
          toStatus: "APPROVED",
          note:
            a.payout > 0
              ? "Tightened the intro and cut the last two paragraphs. Payout set, good work."
              : "Running it now - payout to follow once the desk agrees the rate.",
          createdAt: (a.published as Date) ?? hoursAgo(10),
        },
      });
    }
    if (a.status === "REJECTED" && "rejection" in a) {
      await prisma.review.create({
        data: {
          articleId: created.id,
          editorId: editor.id,
          action: "REJECTED",
          fromStatus: "SUBMITTED",
          toStatus: "REJECTED",
          note: a.rejection as string,
          createdAt: hoursAgo(20),
        },
      });
    }
  }

  const counts = await prisma.article.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("Seeded users:", [admin, editor, maya, sam, leo].map((u) => u.email).join(", "));
  console.log("Password for every demo account:", PASSWORD);
  console.log("Articles:", counts.map((c) => `${c.status}=${c._count._all}`).join(" "));
}

function upsertUser(
  email: string,
  name: string,
  role: "ADMIN" | "EDITOR" | "CONTRIBUTOR",
  tier: "GENERAL" | "VERIFIED",
  passwordHash: string,
  bio: string,
) {
  return prisma.user.upsert({
    where: { email },
    create: { email, name, role, tier, passwordHash, bio },
    update: { name, role, tier, passwordHash, bio },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
