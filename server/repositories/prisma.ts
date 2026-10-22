import { PrismaClient } from "@prisma/client";

const globalPrisma = globalThis as typeof globalThis & { __guardianGatePrisma?: PrismaClient };

/** One Prisma pool per Node process, including across Next.js development reloads. */
export const prisma = globalPrisma.__guardianGatePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalPrisma.__guardianGatePrisma = prisma;
}
