import { apiError, ok, requestIdFrom, type ApiErrorCode } from "@/server/api/response";
import { resolveActor, type TideActor } from "@/server/auth/tide";
import type { PolicyResult } from "@/server/policy/service";
import { ensurePersistenceReady } from "@/server/repositories/persistence";

function codeFor(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  return "INTERNAL_ERROR";
}

export function toResponse<T>(result: PolicyResult<T>, requestId: string) {
  if (result.ok) return ok(result.data, { status: result.status ?? 200 });
  return apiError(result.status, codeFor(result.status), result.message, requestId, {
    reason: result.reason,
    ...(result.details ?? {}),
  });
}

/** Resolves the TideCloak (or simulated) actor server-side and fails closed without one. */
export async function withActor<T>(
  request: Request,
  handler: (actor: TideActor) => PolicyResult<T> | Promise<PolicyResult<T>>,
) {
  const requestId = requestIdFrom(request);
  const actor = await resolveActor(request);
  if (!actor) {
    return apiError(401, "UNAUTHENTICATED", "A valid TideCloak session is required.", requestId, { reason: "unauthenticated" });
  }
  try {
    await ensurePersistenceReady();
    return toResponse(await handler(actor), requestId);
  } catch (error) {
    console.error(error);
    return apiError(500, "INTERNAL_ERROR", "Request failed closed.", requestId);
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function searchParam(request: Request, name: string): string | undefined {
  return new URL(request.url).searchParams.get(name) ?? undefined;
}
