import { NextResponse } from "next/server";
import { apiError, ok, requestIdFrom } from "@/server/api/response";
import { readJson } from "@/server/api/policy-route";
import { DEMO_PERSONAS, findPersona, isDemoAuthEnabled } from "@/server/auth/personas";
import { resolveActor, simulateTideClaims } from "@/server/auth/tide";
import { DEMO_PERSONA_COOKIE, DEMO_TOKEN_PREFIX } from "@/server/auth/token";

function disabled(request: Request) {
  return apiError(404, "NOT_FOUND", "Demo personas are disabled.", requestIdFrom(request));
}

export async function GET(request: Request) {
  if (!isDemoAuthEnabled()) return disabled(request);
  const actor = await resolveActor(request);
  return ok({
    mode: "simulated-tidecloak",
    current: actor ? { subject: actor.subject, username: actor.username ?? null, roles: actor.roles } : null,
    personas: DEMO_PERSONAS,
  });
}

/** Switches the simulated TideCloak session: `{ "persona": "demo-doctor-a" }`. */
export async function POST(request: Request) {
  if (!isDemoAuthEnabled()) return disabled(request);
  const { persona: username } = await readJson(request);
  const persona = typeof username === "string" ? findPersona(username) : undefined;
  if (!persona) {
    return apiError(422, "VALIDATION_ERROR", "Unknown demo persona.", requestIdFrom(request), {
      personas: DEMO_PERSONAS.map((p) => p.username),
    });
  }

  const response = NextResponse.json({
    success: true as const,
    data: {
      persona,
      accessToken: `${DEMO_TOKEN_PREFIX}${persona.username}`,
      claims: simulateTideClaims(persona),
    },
  });
  response.cookies.set(DEMO_PERSONA_COOKIE, persona.username, { httpOnly: true, sameSite: "lax", path: "/" });
  return response;
}

export async function DELETE(request: Request) {
  if (!isDemoAuthEnabled()) return disabled(request);
  const response = NextResponse.json({ success: true as const, data: { signedOut: true } });
  response.cookies.delete(DEMO_PERSONA_COOKIE);
  return response;
}
