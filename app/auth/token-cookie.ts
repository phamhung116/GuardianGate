// The API reads the TideCloak access token from the `kcToken` cookie (server/auth/token.ts).
// A real token takes precedence over any demo persona until it is cleared on logout.

export function storeAccessToken(token: string, expiresAt?: number | null) {
  const maxAge = expiresAt ? Math.max(0, Math.floor(expiresAt - Date.now() / 1000)) : 300;
  document.cookie = `kcToken=${encodeURIComponent(token)}; path=/; SameSite=Lax; max-age=${maxAge}`;
}

export function clearAccessToken() {
  document.cookie = "kcToken=; path=/; SameSite=Lax; max-age=0";
}
