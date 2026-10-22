import { ok } from "@/server/api/response";
import { getEnv } from "@/server/config/env";

export async function GET() {
  const env = getEnv();
  const issuer = `${env.TIDECLOAK_URL}/realms/${env.TIDECLOAK_REALM}`;

  try {
    const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });

    return ok({
      status: response.ok ? "ready" : "degraded",
      dependencies: { tidecloak: response.ok ? "up" : "down" },
    });
  } catch {
    return ok(
      { status: "degraded", dependencies: { tidecloak: "down" } },
      { status: 503 },
    );
  }
}
