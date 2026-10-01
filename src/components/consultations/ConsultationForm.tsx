import React, { useState } from "react";
import { ServerError } from "@/components/auth/ServerError";
import { SlotPicker } from "@/components/consultations/SlotPicker";
import { SurveyStep, type SurveyValues } from "@/components/consultations/SurveyStep";
import { firstFieldErrors, surveySchema } from "@/lib/consultation-schema";
import { cn } from "@/lib/utils";

const EMPTY_SURVEY: SurveyValues = {
  dog_name: "",
  breed: "",
  age_years: "",
  age_months: "",
  basic_info: "",
  goals: "",
};

interface Props {
  initialSlots: string[];
}

function readErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

function readFieldErrorMap(body: unknown): Record<string, string> {
  if (
    typeof body !== "object" ||
    body === null ||
    !("errors" in body) ||
    typeof body.errors !== "object" ||
    body.errors === null
  ) {
    return {};
  }
  const errors: Record<string, string> = {};
  for (const [key, value] of Object.entries(body.errors)) {
    if (typeof value === "string") {
      errors[key] = value;
    }
  }
  return errors;
}

function readSlotList(body: unknown): string[] | null {
  if (typeof body !== "object" || body === null || !("slots" in body) || !Array.isArray(body.slots)) {
    return null;
  }
  return body.slots.filter((slot): slot is string => typeof slot === "string");
}

export default function ConsultationForm({ initialSlots }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<SurveyValues>(EMPTY_SURVEY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState(initialSlots);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  function updateField(field: keyof SurveyValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  }

  function goToSlots() {
    const result = surveySchema.safeParse(values);
    if (!result.success) {
      setErrors(firstFieldErrors(result.error));
      return;
    }
    setErrors({});
    setServerError(null);
    setStep(2);
  }

  async function refreshSlots() {
    const response = await fetch("/api/consultations/slots", { credentials: "same-origin" });
    if (!response.ok) {
      return;
    }
    const payload: unknown = await response.json();
    const nextSlots = readSlotList(payload);
    if (nextSlots === null) {
      return;
    }
    setSlots(nextSlots);
    setSelectedSlot((current) => (nextSlots.includes(current) ? current : ""));
  }

  async function submitConsultation() {
    setSubmitting(true);
    setConflictError(null);
    setServerError(null);

    const formData = new FormData();
    formData.set("dog_name", values.dog_name);
    formData.set("breed", values.breed);
    formData.set("age_years", values.age_years);
    formData.set("age_months", values.age_months);
    formData.set("basic_info", values.basic_info);
    formData.set("goals", values.goals);
    formData.set("slot_start", selectedSlot);

    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (response.status === 201) {
        window.location.assign("/consultations?created=1");
        return;
      }

      const body: unknown = await response.json();

      if (response.status === 400) {
        setErrors(readFieldErrorMap(body));
        setStep(1);
        return;
      }

      if (response.status === 409) {
        setConflictError(
          readErrorMessage(body, "Ten termin został właśnie zajęty albo jest niedostępny — wybierz inny."),
        );
        await refreshSlots();
        return;
      }

      setServerError(readErrorMessage(body, "Nie udało się wysłać zgłoszenia. Spróbuj ponownie."));
    } catch {
      setServerError("Nie udało się wysłać zgłoszenia. Spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      goToSlots();
      return;
    }
    void submitConsultation();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <p className="text-sm text-blue-100/60">Krok {step} z 2</p>
      <ServerError message={serverError} />
      {errors.slot_start ? <ServerError message={errors.slot_start} /> : null}

      <div className={cn(step !== 1 && "hidden")}>
        <SurveyStep values={values} errors={errors} isActive={step === 1} onChange={updateField} />
      </div>
      <div className={cn(step !== 2 && "hidden")}>
        <SlotPicker
          slots={slots}
          selectedSlot={selectedSlot}
          isActive={step === 2}
          submitting={submitting}
          conflictError={conflictError}
          onSelect={(slot) => {
            setSelectedSlot(slot);
            setConflictError(null);
          }}
          onBack={() => {
            setStep(1);
          }}
        />
      </div>
    </form>
  );
}
