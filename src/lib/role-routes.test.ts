import { describe, expect, it } from "vitest";
import { dashboardRedirect, redirectAfterSignIn } from "@/lib/role-routes";

describe("dashboardRedirect", () => {
  it("lets a behaviorist stay on the dashboard", () => {
    expect(dashboardRedirect("behaviorist")).toBeNull();
  });

  it("sends a client to consultations", () => {
    expect(dashboardRedirect("client")).toBe("/consultations");
  });

  it("sends a missing role home", () => {
    expect(dashboardRedirect(null)).toBe("/");
  });
});

describe("redirectAfterSignIn", () => {
  it("sends a behaviorist to the dashboard", () => {
    expect(redirectAfterSignIn("behaviorist")).toBe("/dashboard");
  });

  it("sends a client home", () => {
    expect(redirectAfterSignIn("client")).toBe("/");
  });

  it("sends a missing role home", () => {
    expect(redirectAfterSignIn(null)).toBe("/");
  });
});
