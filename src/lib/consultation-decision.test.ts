import { describe, expect, it } from "vitest";
import { parseDecision } from "@/lib/consultation-decision";

describe("parseDecision", () => {
  it("returns accepted", () => {
    expect(parseDecision("accepted")).toBe("accepted");
  });

  it("returns rejected", () => {
    expect(parseDecision("rejected")).toBe("rejected");
  });

  it("returns null for an empty string", () => {
    expect(parseDecision("")).toBeNull();
  });

  it("returns null for any other value", () => {
    expect(parseDecision("pending")).toBeNull();
  });
});
