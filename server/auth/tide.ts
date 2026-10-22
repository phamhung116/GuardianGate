import { verifyTideCloakToken } from "@tidecloak/nextjs/server";
import adapter from "@/tidecloakAdapter.json";

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

export async function verifyActor(
  token: string,
  requiredRoles: string[] = [],
): Promise<TideActor | null> {
  try {
    const claims = (await verifyTideCloakToken(adapter, token, requiredRoles)) as TideClaims | null;
    if (!claims?.sub) return null;

    return {
      subject: claims.sub,
      username: claims.preferred_username,
      roles: claims.realm_access?.roles ?? [],
      claims,
    };
  } catch {
    return null;
  }
}
