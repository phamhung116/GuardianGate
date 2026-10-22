import { withActor } from "@/server/api/policy-route";
import { getRequest } from "@/server/policy/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, (actor) => getRequest(actor, id));
}
