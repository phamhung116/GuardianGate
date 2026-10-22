import { apiError, requestIdFrom } from "@/server/api/response";
import { searchParam, withActor } from "@/server/api/policy-route";
import { listAudit } from "@/server/policy/service";

export async function GET(request: Request) {
  return withActor(request, (actor) =>
    listAudit(actor, {
      childId: searchParam(request, "childId"),
      requestId: searchParam(request, "requestId"),
      type: searchParam(request, "type"),
    }),
  );
}

function appendOnly(request: Request) {
  return apiError(405, "FORBIDDEN", "The audit log is append-only.", requestIdFrom(request));
}

export const PUT = appendOnly;
export const PATCH = appendOnly;
export const DELETE = appendOnly;
