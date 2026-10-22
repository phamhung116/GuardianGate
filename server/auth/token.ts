export const DEMO_TOKEN_PREFIX = "demo.";
export const DEMO_PERSONA_HEADER = "x-demo-persona";
export const DEMO_PERSONA_COOKIE = "gg_demo_persona";

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

export function readAccessToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    return token.length > 0 ? token : null;
  }

  return readCookie(request, "kcToken");
}

/** Simulated tokens look like `demo.<persona-username>`; real TideCloak tokens are JWTs. */
export function isSimulatedToken(token: string): boolean {
  return token.startsWith(DEMO_TOKEN_PREFIX);
}

export function personaFromSimulatedToken(token: string): string | null {
  if (!isSimulatedToken(token)) return null;
  const username = token.slice(DEMO_TOKEN_PREFIX.length).trim();
  return username.length > 0 ? username : null;
}

/** Demo persona selected by header (tests/scripts) or cookie (persona switcher UI). */
export function readDemoPersona(request: Request): string | null {
  const header = request.headers.get(DEMO_PERSONA_HEADER)?.trim();
  if (header) return header;
  return readCookie(request, DEMO_PERSONA_COOKIE);
}
