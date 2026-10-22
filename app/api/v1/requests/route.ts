import { readJson, searchParam, withActor } from "@/server/api/policy-route";
import { createOrdinaryRequest, listRequests } from "@/server/policy/service";

export async function GET(request: Request) {
  return withActor(request, (actor) =>
    listRequests(actor, { kind: searchParam(request, "kind"), childId: searchParam(request, "childId") }),
  );
}

/** Ordinary consultation request: `{ childId, consultationId?, recordGroups, purpose, durationMinutes }`. */
export async function POST(request: Request) {
  const body = await readJson(request);
  return withActor(request, (actor) => createOrdinaryRequest(actor, body));
}
