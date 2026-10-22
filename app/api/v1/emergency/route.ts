import { readJson, withActor } from "@/server/api/policy-route";
import { createEmergencyRequest, listRequests } from "@/server/policy/service";

export async function GET(request: Request) {
  return withActor(request, (actor) => listRequests(actor, { kind: "emergency" }));
}

/** `{ childId, reason }`. Scope is always the minimum summary; a distinct doctor must confirm. */
export async function POST(request: Request) {
  const body = await readJson(request);
  return withActor(request, (actor) => createEmergencyRequest(actor, body));
}
