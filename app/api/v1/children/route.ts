import { withActor } from "@/server/api/policy-route";
import { listChildren } from "@/server/policy/service";

export async function GET(request: Request) {
  return withActor(request, (actor) => ({ ok: true, data: listChildren(actor) }));
}
