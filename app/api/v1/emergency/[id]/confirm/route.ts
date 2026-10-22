import { readJson, withActor } from "@/server/api/policy-route";
import { decideRequest } from "@/server/policy/service";

/** Independent second-doctor confirmation; defaults to approval. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  return withActor(request, (actor) => decideRequest(actor, id, { decision: body.decision ?? "approved", note: body.note }));
}
