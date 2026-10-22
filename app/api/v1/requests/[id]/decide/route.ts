import { readJson, withActor } from "@/server/api/policy-route";
import { decideRequest } from "@/server/policy/service";

/** `{ decision: "approved" | "rejected", note? }`. Guardian for ordinary/external share; second doctor for emergency. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  return withActor(request, (actor) => decideRequest(actor, id, body));
}
