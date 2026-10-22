import { apiError, ok, requestIdFrom } from "@/server/api/response";
import { isDemoAuthEnabled } from "@/server/auth/personas";
import { resetState } from "@/server/policy/store";

/** Restores the deterministic fake seed so the demo can be replayed. */
export async function POST(request: Request) {
  if (!isDemoAuthEnabled()) return apiError(404, "NOT_FOUND", "Demo reset is disabled.", requestIdFrom(request));
  resetState();
  return ok({ reset: true });
}
