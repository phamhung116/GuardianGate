import { withActor } from "@/server/api/policy-route";
import { emergencyReviewQueue } from "@/server/policy/service";

export async function GET(request: Request) {
  return withActor(request, (actor) => emergencyReviewQueue(actor));
}
