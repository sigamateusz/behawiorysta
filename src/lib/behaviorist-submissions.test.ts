import { describe, expect, it } from "vitest";
import { visibleSubmissions } from "@/lib/behaviorist-submissions";

// 15:00 in Warsaw (CEST, UTC+2).
const NOW = new Date("2026-10-08T13:00:00.000Z");

const fafik = {
  id: "fafik",
  status: "pending",
  slot_start: "2026-10-07T08:00:00.000Z",
  created_at: "2026-10-01T10:00:00.000Z",
  dog_name: "Fafik",
};

const burek = {
  id: "burek",
  status: "pending",
  slot_start: "2026-10-09T08:00:00.000Z",
  created_at: "2026-10-02T10:00:00.000Z",
  dog_name: "Burek",
};

const azor = {
  id: "azor",
  status: "accepted",
  slot_start: "2026-11-02T16:00:00.000Z",
  created_at: "2026-10-03T10:00:00.000Z",
  dog_name: "Azor",
};

const reks = {
  id: "reks",
  status: "rejected",
  slot_start: "2026-10-09T09:00:00.000Z",
  created_at: "2026-10-04T10:00:00.000Z",
  dog_name: "Reks",
};

const luna = {
  id: "luna",
  status: "accepted",
  slot_start: "2026-10-05T08:00:00.000Z",
  created_at: "2026-10-05T10:00:00.000Z",
  dog_name: "Luna",
};

const dogs = [luna, reks, azor, burek, fafik];

describe("visibleSubmissions", () => {
  it("returns pending rows and accepted rows still inside the slot, oldest slot first", () => {
    const result = visibleSubmissions(dogs, NOW);

    expect(result.map((row) => row.id)).toEqual(["fafik", "burek", "azor"]);
    expect(result).toEqual([fafik, burek, azor]);
    expect(result[0]).toBe(fafik);
    expect(result.map((row) => row.id)).not.toContain("reks");
    expect(result.map((row) => row.id)).not.toContain("luna");
    expect(dogs.map((row) => row.id)).toEqual(["luna", "reks", "azor", "burek", "fafik"]);
  });

  it("drops unparseable timestamps and any other status", () => {
    const pending = {
      id: "ok",
      status: "pending",
      slot_start: "2026-10-09T08:00:00.000Z",
      created_at: "2026-10-01T10:00:00.000Z",
    };
    const badSlot = { ...pending, id: "bad-slot", slot_start: "not-a-date" };
    const badCreated = { ...pending, id: "bad-created", created_at: "not-a-date" };
    const other = { ...pending, id: "other", status: "cancelled" };

    expect(visibleSubmissions([badSlot, other, badCreated, pending], NOW)).toEqual([pending]);
  });

  it("keeps an accepted slot 30 minutes after it starts", () => {
    const row = {
      id: "granica",
      status: "accepted",
      slot_start: "2026-10-08T12:00:00.000Z",
      created_at: "2026-10-01T10:00:00.000Z",
    };

    expect(visibleSubmissions([row], new Date("2026-10-08T12:30:00.000Z"))).toEqual([row]);
  });

  it("hides an accepted slot when the 60-minute window has just ended", () => {
    const row = {
      id: "granica",
      status: "accepted",
      slot_start: "2026-10-08T12:00:00.000Z",
      created_at: "2026-10-01T10:00:00.000Z",
    };

    expect(visibleSubmissions([row], new Date("2026-10-08T13:00:00.000Z"))).toEqual([]);
  });

  it("orders the same slot start by earlier created_at", () => {
    const earlier = {
      id: "b",
      status: "pending",
      slot_start: "2026-10-09T08:00:00.000Z",
      created_at: "2026-10-01T10:00:00.000Z",
    };
    const later = {
      id: "a",
      status: "pending",
      slot_start: "2026-10-09T08:00:00.000Z",
      created_at: "2026-10-02T10:00:00.000Z",
    };

    expect(visibleSubmissions([later, earlier], NOW).map((row) => row.id)).toEqual(["b", "a"]);
  });

  it("orders equal created_at by id", () => {
    const zed = {
      id: "zed",
      status: "pending",
      slot_start: "2026-10-09T08:00:00.000Z",
      created_at: "2026-10-01T10:00:00.000Z",
    };
    const amy = {
      id: "amy",
      status: "pending",
      slot_start: "2026-10-09T08:00:00.000Z",
      created_at: "2026-10-01T10:00:00.000Z",
    };

    expect(visibleSubmissions([zed, amy], NOW).map((row) => row.id)).toEqual(["amy", "zed"]);
  });
});
