/* global process, fetch, URLSearchParams, console */
// Idempotently provisions the local TideCloak Dev realm used by GuardianGate:
// realm `guardiangate`, public PKCE client `guardiangate-web`, the five realm roles and one
// user per demo persona (username = persona, so it maps onto the synthetic seed).
// Local demo only: admin/password and user passwords are throwaway development values.
//
// Usage: node scripts/provision-tidecloak.mjs

const BASE = process.env.TIDECLOAK_URL ?? "http://localhost:8080";
const REALM = process.env.TIDECLOAK_REALM ?? "guardiangate";
const CLIENT_ID = process.env.TIDECLOAK_CLIENT_ID ?? "guardiangate-web";
const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";
const ADMIN_USER = process.env.TIDECLOAK_ADMIN_USER ?? "admin";
const ADMIN_PASSWORD = process.env.TIDECLOAK_ADMIN_PASSWORD ?? "password";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "demo1234";

const ROLES = ["doctor", "guardian", "admin", "privacy_officer", "compliance_approver"];
const USERS = [
  ["demo-doctor-a", "An", "Nguyen", "doctor"],
  ["demo-doctor-b", "Binh", "Tran", "doctor"],
  ["demo-doctor-unassigned", "Unassigned", "Doctor", "doctor"],
  ["demo-guardian-a", "Guardian", "An", "guardian"],
  ["demo-guardian-b", "Guardian", "Binh", "guardian"],
  ["demo-privacy", "Privacy", "Officer", "privacy_officer"],
  ["demo-compliance", "Compliance", "Approver", "compliance_approver"],
  ["demo-admin", "Platform", "Administrator", "admin"],
];

async function adminToken() {
  const res = await fetch(`${BASE}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", client_id: "admin-cli", username: ADMIN_USER, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Admin login failed (${res.status}). Is TideCloak running at ${BASE}?`);
  return (await res.json()).access_token;
}

const token = await adminToken();

async function api(method, path, body) {
  const res = await fetch(`${BASE}/admin/realms${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 409) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

if ((await fetch(`${BASE}/realms/${REALM}`)).status === 404) {
  await api("POST", "", { realm: REALM, enabled: true });
  console.log(`created realm ${REALM}`);
}

// @tidecloak/verify only accepts ES256/ES384/ES512/EdDSA, so sign this realm's tokens with ES256
// (Tide enrollment later switches the realm to its own EdDSA key).
const realmRep = await api("GET", `/${REALM}`);
const components = await api("GET", `/${REALM}/components?type=org.keycloak.keys.KeyProvider`);
if (!components.some((c) => c.providerId === "ecdsa-generated")) {
  await api("POST", `/${REALM}/components`, {
    name: "ecdsa-es256",
    providerId: "ecdsa-generated",
    providerType: "org.keycloak.keys.KeyProvider",
    parentId: realmRep.id,
    config: { priority: ["200"], enabled: ["true"], active: ["true"], ecdsaEllipticCurveKey: ["P-256"] },
  });
}
if (realmRep.defaultSignatureAlgorithm !== "ES256" && realmRep.defaultSignatureAlgorithm !== "EdDSA") {
  await api("PUT", `/${REALM}`, { ...realmRep, defaultSignatureAlgorithm: "ES256" });
}
console.log(`token signing: ${realmRep.defaultSignatureAlgorithm === "EdDSA" ? "EdDSA (Tide)" : "ES256"}`);

const clientSpec = {
  clientId: CLIENT_ID,
  enabled: true,
  publicClient: true,
  standardFlowEnabled: true,
  directAccessGrantsEnabled: false,
  redirectUris: [`${APP_ORIGIN}/auth/redirect`, `${APP_ORIGIN}/silent-check-sso.html`],
  webOrigins: [APP_ORIGIN],
  attributes: { "pkce.code.challenge.method": "S256", "post.logout.redirect.uris": `${APP_ORIGIN}/*` },
};
const [existingClient] = await api("GET", `/${REALM}/clients?clientId=${CLIENT_ID}`);
if (existingClient) await api("PUT", `/${REALM}/clients/${existingClient.id}`, { ...existingClient, ...clientSpec });
else await api("POST", `/${REALM}/clients`, clientSpec);
console.log(`client ${CLIENT_ID} ready`);

for (const role of ROLES) await api("POST", `/${REALM}/roles`, { name: role });
console.log(`roles ready: ${ROLES.join(", ")}`);

for (const [username, firstName, lastName, role] of USERS) {
  await api("POST", `/${REALM}/users`, {
    username,
    firstName,
    lastName,
    email: `${username}@guardiangate.invalid`,
    emailVerified: true,
    enabled: true,
    credentials: [{ type: "password", value: DEMO_PASSWORD, temporary: false }],
  });
  const [user] = await api("GET", `/${REALM}/users?username=${username}&exact=true`);
  const roleRep = await api("GET", `/${REALM}/roles/${role}`);
  await api("POST", `/${REALM}/users/${user.id}/role-mappings/realm`, [roleRep]);
  console.log(`user ${username} -> ${role}`);
}

console.log(`\nDone. Sign in at ${APP_ORIGIN}/auth/login with any demo username and password "${DEMO_PASSWORD}".`);
