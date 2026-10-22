import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_PERSONAS } from "@/server/auth/personas";
import { resolveActor, verifyActor } from "@/server/auth/tide";

const request = (headers: Record<string, string>) => new Request("http://localhost/api/v1/me", { headers });

describe("simulated TideCloak sessions", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("issues realm guardiangate / client guardiangate-web claims for every persona", async () => {
    for (const persona of DEMO_PERSONAS) {
      const actor = await verifyActor(`demo.${persona.username}`);
      expect(actor?.subject).toBe(persona.username);
      expect(actor?.username).toBe(persona.username);
      expect(actor?.roles).toEqual(expect.arrayContaining(persona.roles));
      expect(actor?.claims).toMatchObject({
        iss: "http://localhost:8080/realms/guardiangate",
        azp: "guardiangate-web",
        tide_simulated: true,
      });
    }
  });

  it("resolves a persona from header or cookie when no token is sent", async () => {
    expect((await resolveActor(request({ "x-demo-persona": "demo-privacy" })))?.roles).toContain("privacy_officer");
    expect((await resolveActor(request({ cookie: "gg_demo_persona=demo-admin" })))?.roles).toContain("admin");
  });

  it("enforces required roles on simulated tokens", async () => {
    expect(await verifyActor("demo.demo-admin", ["doctor"])).toBeNull();
    expect(await verifyActor("demo.demo-doctor-a", ["doctor"])).not.toBeNull();
  });

  it("fails closed for unknown personas and an invalid real token, without persona fallback", async () => {
    expect(await verifyActor("demo.someone-else")).toBeNull();
    expect(await resolveActor(request({ authorization: "Bearer not-a-jwt", "x-demo-persona": "demo-doctor-a" }))).toBeNull();
  });

  it("disables simulation when demo auth is off or in production", async () => {
    vi.stubEnv("GUARDIANGATE_DEMO_AUTH", "off");
    expect(await verifyActor("demo.demo-doctor-a")).toBeNull();
    vi.stubEnv("GUARDIANGATE_DEMO_AUTH", "on");
    vi.stubEnv("NODE_ENV", "production");
    expect(await resolveActor(request({ "x-demo-persona": "demo-doctor-a" }))).toBeNull();
  });
});
