import { describe, expect, it } from "vitest";

import { prisma } from "@/server/repositories/prisma";

const postgresSuite = process.env.RUN_DATABASE_TESTS === "1" ? describe : describe.skip;

postgresSuite("Prisma/PostgreSQL demo seed", () => {
  it("contains the complete fake identity, relationship, record, and request baseline", async () => {
    const [users, children, verifiedGuardians, consultations, requests, summaries] =
      await prisma.$transaction([
        prisma.appUser.count(),
        prisma.child.count(),
        prisma.guardianLink.count({ where: { verified: true } }),
        prisma.consultation.count({ where: { status: "active" } }),
        prisma.accessRequest.count(),
        prisma.clinicalSummary.count(),
      ]);

    expect({ users, children, verifiedGuardians, consultations, requests, summaries }).toEqual({
      users: 8,
      children: 1,
      verifiedGuardians: 2,
      consultations: 1,
      requests: 1,
      summaries: 1,
    });
  });
});
