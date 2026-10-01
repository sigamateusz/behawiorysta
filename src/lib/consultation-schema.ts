import { z } from "astro/zod";

function requiredText(max: number, emptyMessage: string, tooLongMessage: string) {
  return z.string({ error: emptyMessage }).trim().min(1, { error: emptyMessage }).max(max, { error: tooLongMessage });
}

function integerField(min: number, max: number, message: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce
      .number({ error: message })
      .int({ error: message })
      .min(min, { error: message })
      .max(max, { error: message }),
  );
}

const surveyShape = z.object({
  dog_name: requiredText(60, "Podaj imię psa", "Imię psa może mieć najwyżej 60 znaków"),
  breed: requiredText(80, "Podaj rasę psa", "Rasa może mieć najwyżej 80 znaków"),
  age_years: integerField(0, 25, "Lata: 0–25"),
  age_months: integerField(0, 11, "Miesiące: 0–11"),
  basic_info: requiredText(
    2000,
    "Podaj podstawowe informacje o psie",
    "Podstawowe informacje mogą mieć najwyżej 2000 znaków",
  ),
  goals: z
    .string({ error: "Opisz, nad czym chcesz pracować" })
    .trim()
    .min(20, { error: "Opis celów musi mieć co najmniej 20 znaków" })
    .max(2000, { error: "Opis celów może mieć najwyżej 2000 znaków" }),
});

const MIN_AGE_MESSAGE = "Wiek psa musi wynosić co najmniej 1 miesiąc";

function hasMinimumAge(data: { age_years: number; age_months: number }) {
  return data.age_years * 12 + data.age_months >= 1;
}

export const surveySchema = surveyShape.refine(hasMinimumAge, { error: MIN_AGE_MESSAGE, path: ["age_months"] });

export const consultationSchema = surveyShape
  .extend({
    slot_start: z.iso.datetime({ offset: true, error: "Wybierz termin konsultacji" }),
  })
  .refine(hasMinimumAge, { error: MIN_AGE_MESSAGE, path: ["age_months"] });

export type SurveyInput = z.infer<typeof surveySchema>;
export type ConsultationInput = z.infer<typeof consultationSchema>;

export function firstFieldErrors(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".") || "form";
    if (!(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
