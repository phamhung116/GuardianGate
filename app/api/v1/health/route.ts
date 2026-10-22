import { ok } from "@/server/api/response";
import { getEnv } from "@/server/config/env";
import { ensurePersistenceReady } from "@/server/repositories/persistence";

export async function GET() {
  const env = getEnv();
  const issuer = `${env.TIDECLOAK_URL}/realms/${env.TIDECLOAK_REALM}`;
  const store = await ensurePersistenceReady();
  const persistence = {
    requested: store.requested,
    active: store.active,
    reason: store.reason?.split("\n").find((line) => line.trim().length > 0)?.trim() ?? null,
  };

  try {
    const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });

    return ok({
      status: response.ok ? "ready" : "degraded",
      dependencies: { tidecloak: response.ok ? "up" : "down" },
      persistence,
    });
  } catch {
    return ok(
      { status: "degraded", dependencies: { tidecloak: "down" }, persistence },
      { status: 503 },
    );
  }
}
