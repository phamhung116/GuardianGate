import { readJson, withActor } from "@/server/api/policy-route";
import { decidePolicyProposal } from "@/server/policy/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  return withActor(request, (actor) => decidePolicyProposal(actor, id, body));
}
