import { apiError, ok, requestIdFrom } from "@/server/api/response";
import { readJson } from "@/server/api/policy-route";
import { isDemoAuthEnabled } from "@/server/auth/personas";
import { advanceClock, now } from "@/server/policy/store";

/** Demo time travel, forward only: `{ "advanceMinutes": 61 }` makes grants expire on the next access. */
export async function POST(request: Request) {
  if (!isDemoAuthEnabled()) return apiError(404, "NOT_FOUND", "Demo clock is disabled.", requestIdFrom(request));
  const { advanceMinutes } = await readJson(request);
  const minutes = Number(advanceMinutes);
  if (!(minutes > 0)) {
    return apiError(422, "VALIDATION_ERROR", "advanceMinutes must be a positive number.", requestIdFrom(request));
  }
  advanceClock(minutes);
  return ok({ now: now().toISOString() });
}
