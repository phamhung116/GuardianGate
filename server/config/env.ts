import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Optional so the demo still boots without a .env; persistence then falls back to memory.
  DATABASE_URL: z.string().min(1).optional(),
  // Defaults match the committed public adapter (tidecloakAdapter.json).
  TIDECLOAK_URL: z.string().url().default("http://localhost:8080"),
  TIDECLOAK_REALM: z.string().min(1).default("guardiangate"),
  TIDECLOAK_CLIENT_ID: z.string().min(1).default("guardiangate-web"),
  // Empty in .env.example until BE-005 deploys the Forseti contract.
  TIDE_POLICY_CONTRACT_ID: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional()),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}
