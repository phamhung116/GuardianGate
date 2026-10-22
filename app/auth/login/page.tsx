"use client";

import { useEffect, useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import adapter from "@/tidecloakAdapter.json";
import { clearAccessToken, storeAccessToken } from "@/app/auth/token-cookie";

interface ServerActor {
  subject: string;
  username: string | null;
  roles: string[];
  simulated: boolean;
}

const realmRoles = ["doctor", "guardian", "admin", "privacy_officer", "compliance_approver"];
const issuer = `${adapter["auth-server-url"].replace(/\/$/, "")}/realms/${adapter.realm}`;

export default function LoginPage() {
  const { authenticated, isInitializing, token, tokenExp, login, logout } = useTideCloak();
  const [serverActor, setServerActor] = useState<ServerActor | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Keep the API cookie in step with token refreshes, then ask the server who it sees.
  useEffect(() => {
    if (isInitializing) return;
    if (authenticated && token) storeAccessToken(token, tokenExp);
    fetch("/api/v1/me", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        setServerActor(body.success ? body.data : null);
        setServerError(body.success ? null : body.error?.message ?? "Request failed");
      })
      .catch(() => setServerError("API unavailable"));
  }, [authenticated, isInitializing, token, tokenExp]);

  const handleLogout = () => {
    clearAccessToken();
    logout();
  };

  const missingRole = serverActor && !serverActor.simulated && !serverActor.roles.some((r) => realmRoles.includes(r));

  return (
    <main className="shell" style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
      <p className="eyebrow">GuardianGate · TideCloak</p>
      <h1>Sign in with TideCloak</h1>
      <p className="lede">
        Realm <code>{adapter.realm}</code> · client <code>{adapter.resource}</code> · issuer <code>{issuer}</code>
      </p>

      <section className="panel" style={{ marginTop: 24, padding: 20 }}>
        {isInitializing ? (
          <p>Connecting to TideCloak… If this never finishes, TideCloak is not reachable at {adapter["auth-server-url"]}.</p>
        ) : authenticated ? (
          <>
            <p>
              ✅ Signed in with a real TideCloak token. API calls from this browser now use this identity instead of the
              demo persona.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <a className="btn btn-primary" href="/">Open GuardianGate</a>
              <button className="btn btn-secondary" onClick={handleLogout}>Sign out</button>
            </div>
          </>
        ) : (
          <>
            <p>Not signed in. Demo personas on the main page still work without TideCloak.</p>
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => login()}>Sign in with TideCloak</button>
              <a className="btn btn-secondary" href="/">Back to demo personas</a>
            </div>
          </>
        )}
      </section>

      <section className="panel" style={{ marginTop: 16, padding: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>What the server verified</h2>
        {serverActor ? (
          <ul>
            <li>Subject: <code>{serverActor.subject}</code></li>
            <li>Username: <code>{serverActor.username ?? "—"}</code></li>
            <li>Roles: <code>{serverActor.roles.join(", ") || "none"}</code></li>
            <li>Source: {serverActor.simulated ? "simulated demo persona" : "real TideCloak token"}</li>
          </ul>
        ) : (
          <p>{serverError ?? "No session."}</p>
        )}
        {missingRole && (
          <p>
            ⚠️ This user has none of the GuardianGate realm roles ({realmRoles.join(", ")}). Assign one in the TideCloak
            admin console, then sign in again.
          </p>
        )}
      </section>
    </main>
  );
}
