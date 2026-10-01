import { describe, expect, it } from "vitest";
import { BREEDS } from "@/lib/breeds";
import { consultationSchema, surveySchema } from "@/lib/consultation-schema";

const validSurvey = {
  dog_name: "  Burek ",
  breed: "Labrador retriever",
  age_years: "2",
  age_months: "3",
  basic_info: "Pies ze schroniska, mieszka z nami od roku.",
  goals: "Ciągnięcie na smyczy i szczekanie na inne psy.",
};

function errorPaths(input: unknown) {
  const result = surveySchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("surveySchema", () => {
  it("accepts a complete survey and trims and coerces values", () => {
    const result = surveySchema.safeParse(validSurvey);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ dog_name: "Burek", age_years: 2, age_months: 3 });
  });

  it.each(["dog_name", "breed", "basic_info", "goals"])("rejects blank %s", (field) => {
    expect(errorPaths({ ...validSurvey, [field]: "   " })).toContain(field);
  });

  it("rejects missing age fields", () => {
    expect(errorPaths({ ...validSurvey, age_years: "" })).toContain("age_years");
    expect(errorPaths({ ...validSurvey, age_months: undefined })).toContain("age_months");
  });

  it("rejects goals shorter than 20 characters after trim", () => {
    const result = surveySchema.safeParse({ ...validSurvey, goals: `   ${"a".repeat(19)}   ` });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Opis celów musi mieć co najmniej 20 znaków");
  });

  it("accepts goals of exactly 20 characters", () => {
    expect(surveySchema.safeParse({ ...validSurvey, goals: "a".repeat(20) }).success).toBe(true);
  });

  it("rejects age_months = 12 and non-integer ages", () => {
    expect(errorPaths({ ...validSurvey, age_months: "12" })).toContain("age_months");
    expect(errorPaths({ ...validSurvey, age_years: "1.5" })).toContain("age_years");
    expect(errorPaths({ ...validSurvey, age_years: "26" })).toContain("age_years");
  });

  it("rejects a total age of 0 years 0 months on age_months", () => {
    const result = surveySchema.safeParse({ ...validSurvey, age_years: "0", age_months: "0" });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["age_months"], message: "Wiek psa musi wynosić co najmniej 1 miesiąc" }),
    ]);
  });

  it("accepts a breed outside BREEDS", () => {
    const breed = "Mieszaniec w typie owczarka";
    expect(BREEDS).not.toContain(breed);
    expect(surveySchema.safeParse({ ...validSurvey, breed }).success).toBe(true);
  });

  it("rejects values longer than the database limits", () => {
    expect(errorPaths({ ...validSurvey, dog_name: "a".repeat(61) })).toContain("dog_name");
    expect(errorPaths({ ...validSurvey, breed: "a".repeat(81) })).toContain("breed");
    expect(errorPaths({ ...validSurvey, basic_info: "a".repeat(2001) })).toContain("basic_info");
    expect(errorPaths({ ...validSurvey, goals: "a".repeat(2001) })).toContain("goals");
  });
});

describe("consultationSchema", () => {
  it("accepts an ISO slot_start", () => {
    const result = consultationSchema.safeParse({ ...validSurvey, slot_start: "2026-10-06T08:00:00.000Z" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing or invalid slot_start", () => {
    expect(consultationSchema.safeParse(validSurvey).success).toBe(false);
    expect(consultationSchema.safeParse({ ...validSurvey, slot_start: "jutro o 10" }).success).toBe(false);
  });

  it("keeps the minimum age rule", () => {
    const result = consultationSchema.safeParse({
      ...validSurvey,
      age_years: "0",
      age_months: "0",
      slot_start: "2026-10-06T08:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("BREEDS", () => {
  it("is sorted in Polish order without duplicates", () => {
    expect([...BREEDS].sort((a, b) => a.localeCompare(b, "pl"))).toEqual(BREEDS);
    expect(new Set(BREEDS).size).toBe(BREEDS.length);
  });

  it("includes common breeds and the mixed-breed option", () => {
    expect(BREEDS).toContain("Mieszaniec");
    expect(BREEDS).toContain("Labrador retriever");
    expect(BREEDS.length).toBeGreaterThanOrEqual(190);
  });
});
