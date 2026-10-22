import { readJson, withActor } from "@/server/api/policy-route";
import { createPolicyProposal, listPolicy } from "@/server/policy/service";

export async function GET(request: Request) {
  return withActor(request, (actor) => listPolicy(actor));
}

/** Admin only: `{ changeType, proposedValue, rationale? }`. Has no effect until Privacy + Compliance approve. */
export async function POST(request: Request) {
  const body = await readJson(request);
  return withActor(request, (actor) => createPolicyProposal(actor, body));
}
