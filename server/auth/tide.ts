import adapter from "@/tidecloakAdapter.json";
import { findPersona, isDemoAuthEnabled, type DemoPersona } from "@/server/auth/personas";
import {
  isSimulatedToken,
  personaFromSimulatedToken,
  readAccessToken,
  readDemoPersona,
} from "@/server/auth/token";

export interface TideActor {
  subject: string;
  username?: string;
  roles: string[];
  claims: Record<string, unknown>;
}

type TideClaims = Record<string, unknown> & {
  sub?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
};

const issuer = `${adapter["auth-server-url"].replace(/\/$/, "")}/realms/${adapter.realm}`;
const SIMULATED_TOKEN_LIFETIME_SECONDS = 300;

function toActor(claims: TideClaims): TideActor | null {
  if (!claims.sub) return null;
  return {
    subject: claims.sub,
    username: claims.preferred_username,
    roles: claims.realm_access?.roles ?? [],
    claims,
  };
}

/**
 * Builds the claim set TideCloak issues for `guardiangate-web` in realm `guardiangate`.
 * The subject is the persona username, which matches `app_users.tide_subject` in the seed.
 */
export function simulateTideClaims(persona: DemoPersona, now = Date.now()): TideClaims {
  const iat = Math.floor(now / 1000);
  return {
    iss: issuer,
    aud: "account",
    azp: adapter.resource,
    typ: "Bearer",
    sub: persona.username,
    preferred_username: persona.username,
    name: persona.displayName,
    iat,
    exp: iat + SIMULATED_TOKEN_LIFETIME_SECONDS,
    scope: "openid profile",
    realm_access: {
      roles: [...persona.roles, "offline_access", `default-roles-${adapter.realm}`],
    },
    resource_access: { [adapter.resource]: { roles: [] } },
    tide_simulated: true,
  };
}

export function simulateActor(username: string, requiredRoles: string[] = []): TideActor | null {
  if (!isDemoAuthEnabled()) return null;
  const persona = findPersona(username);
  if (!persona) return null;

  const actor = toActor(simulateTideClaims(persona));
  if (!actor || !requiredRoles.every((role) => actor.roles.includes(role))) return null;
  return actor;
}

export async function verifyActor(
  token: string,
  requiredRoles: string[] = [],
): Promise<TideActor | null> {
  if (isSimulatedToken(token)) {
    const username = personaFromSimulatedToken(token);
    return username ? simulateActor(username, requiredRoles) : null;
  }

  try {
    // Loaded lazily so simulated sessions (and Node test runs) never depend on the SDK bundle.
    const { verifyTideCloakToken } = await import("@tidecloak/verify");
    const claims = (await verifyTideCloakToken(adapter, token, requiredRoles)) as TideClaims | null;
    const actor = claims ? toActor(claims) : null;
    // The synthetic seed keys relationships by persona username (`app_users.tide_subject`). A
    // verified realm user with that username acts as the seeded user; the real `sub` stays in claims.
    if (actor?.username && findPersona(actor.username)) return { ...actor, subject: actor.username };
    return actor;
  } catch {
    return null;
  }
}

/**
 * Resolves the caller from a real TideCloak token first. A demo persona header/cookie is used
 * only when no token is present and demo auth is enabled; an invalid real token never falls
 * back to a persona.
 */
export async function resolveActor(request: Request): Promise<TideActor | null> {
  const token = readAccessToken(request);
  if (token) return verifyActor(token);

  const persona = readDemoPersona(request);
  return persona ? simulateActor(persona) : null;
}
