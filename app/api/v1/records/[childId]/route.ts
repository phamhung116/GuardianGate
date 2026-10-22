import { searchParam, withActor } from "@/server/api/policy-route";
import { readChildRecord } from "@/server/policy/service";

/** Returns only the groups covered by an active grant. Optional `?groups=summary,encounter`. */
export async function GET(request: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const groups = searchParam(request, "groups");
  return withActor(request, (actor) =>
    readChildRecord(actor, childId, groups === undefined ? {} : { groups: groups.split(",").filter(Boolean) }),
  );
}
