import { apiError, ok, requestIdFrom } from "@/server/api/response";
import { resolveActor } from "@/server/auth/tide";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const actor = await resolveActor(request);

  if (!actor) {
    return apiError(401, "UNAUTHENTICATED", "A valid TideCloak session is required.", requestId);
  }

  return ok({
    subject: actor.subject,
    username: actor.username ?? null,
    roles: actor.roles,
    simulated: actor.claims.tide_simulated === true,
  });
}
