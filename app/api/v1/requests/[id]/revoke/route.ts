import { readJson, withActor } from "@/server/api/policy-route";
import { revokeRequest } from "@/server/policy/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  return withActor(request, (actor) => revokeRequest(actor, id, body));
}
