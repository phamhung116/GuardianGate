import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  TIDECLOAK_URL: z.string().url(),
  TIDECLOAK_REALM: z.string().min(1),
  TIDECLOAK_CLIENT_ID: z.string().min(1),
  TIDE_POLICY_CONTRACT_ID: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}
