import { describe, expect, it } from "vitest";
import { readAccessToken } from "@/server/auth/token";

describe("readAccessToken", () => {
  it("prefers a bearer access token", () => {
    const request = new Request("http://localhost/api/v1/me", {
      headers: { authorization: "Bearer signed-token", cookie: "kcToken=cookie-token" },
    });
    expect(readAccessToken(request)).toBe("signed-token");
  });

  it("accepts the TideCloak cookie", () => {
    const request = new Request("http://localhost/api/v1/me", {
      headers: { cookie: "theme=light; kcToken=cookie-token" },
    });
    expect(readAccessToken(request)).toBe("cookie-token");
  });

  it("fails closed when no token is present", () => {
    expect(readAccessToken(new Request("http://localhost/api/v1/me"))).toBeNull();
  });
});
