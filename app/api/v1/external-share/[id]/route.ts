import { withActor } from "@/server/api/policy-route";
import { getExternalShare } from "@/server/policy/service";

/** Status plus the released package, which stays null until all verified guardians approve. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, (actor) => getExternalShare(actor, id));
}
