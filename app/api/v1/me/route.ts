import { apiError, ok, requestIdFrom } from "@/server/api/response";
import { readAccessToken } from "@/server/auth/token";
import { verifyActor } from "@/server/auth/tide";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const token = readAccessToken(request);

  if (!token) {
    return apiError(401, "UNAUTHENTICATED", "Authentication is required.", requestId);
  }

  const actor = await verifyActor(token);
  if (!actor) {
    return apiError(401, "UNAUTHENTICATED", "The TideCloak token is invalid or expired.", requestId);
  }

  return ok({
    subject: actor.subject,
    username: actor.username ?? null,
    roles: actor.roles,
  });
}
