import { readJson, withActor } from "@/server/api/policy-route";
import { createExternalShare, listRequests } from "@/server/policy/service";

export async function GET(request: Request) {
  return withActor(request, (actor) => listRequests(actor, { kind: "external_share" }));
}

/** `{ childId, recipientName, recordGroups, purpose, durationMinutes }`; every verified guardian must then approve. */
export async function POST(request: Request) {
  const body = await readJson(request);
  return withActor(request, (actor) => createExternalShare(actor, body));
}
