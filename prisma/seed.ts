/**
 * Development seed data.
 *
 * This is a TEMPORARY stand-in for GenLayer's Fixture Discovery Contract
 * (PROJECT.md §6, Phase 4 — "Market Engine"). In production, Matches and
 * their canonical Markets are discovered and created by that Intelligent
 * Contract, not by a script. This seed exists purely so Discover Feed and
 * Prediction creation (Phase 3) are testable end to end before Phase 4
 * wires up the real thing. Delete this file once fixture discovery is
 * live — do not build on top of it as a permanent data source.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const fixtures = [
  {
    externalId: "seed-fixture-1",
    competition: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    kickoff: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2), // +2 days
  },
  {
    externalId: "seed-fixture-2",
    competition: "La Liga",
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    kickoff: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // +3 days
  },
  {
    externalId: "seed-fixture-3",
    competition: "Serie A",
    homeTeam: "Inter Milan",
    awayTeam: "AC Milan",
    kickoff: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5), // +5 days
  },
];

async function main() {
  for (const fixture of fixtures) {
    const match = await prisma.match.upsert({
      where: { externalId: fixture.externalId },
      update: {},
      create: { ...fixture, status: "SCHEDULED" },
    });

    await prisma.market.upsert({
      where: { matchId_type: { matchId: match.id, type: "MATCH_RESULT" } },
      update: {},
      create: {
        matchId: match.id,
        type: "MATCH_RESULT",
        status: "OPEN",
      },
    });
  }

  console.log(`Seeded ${fixtures.length} matches with MATCH_RESULT markets.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
